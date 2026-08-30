import { checkRateLimit } from '@/lib/ai/ratelimit';
import { checkGuardrails } from '@/lib/guardrails';
import { RAGEngine } from '@/lib/rag-engine';
import { routeChatStream } from '@/lib/ai/router';
import { systemPrompt } from '@/lib/ai/system-prompt';
import { UIMessage, createUIMessageStream, createUIMessageStreamResponse } from 'ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ragEngine = new RAGEngine();

function getMessageText(message: any): string {
    if (!message) return '';
    if (typeof message.content === 'string' && message.content) {
        return message.content;
    }
    if (Array.isArray(message.parts)) {
        return message.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('');
    }
    return '';
}

async function* normalizeStream(stream: any): AsyncGenerator<string, void, unknown> {
    if (stream && typeof stream.on === 'function') {
        // Anthropic MessageStream (Event Emitter style / Symbol.asyncIterator)
        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                yield event.delta.text;
            }
        }
    } else if (stream && (typeof stream.next === 'function' || stream[Symbol.asyncIterator])) {
        // AsyncIterable (Gemini content stream or Groq AI SDK stream)
        for await (const chunk of stream) {
            if (typeof chunk === 'string') {
                yield chunk;
            } else if (chunk && typeof chunk.text === 'function') {
                yield chunk.text();
            } else if (chunk && chunk.candidates && chunk.candidates[0]?.content?.parts?.[0]?.text) {
                yield chunk.candidates[0].content.parts[0].text;
            }
        }
    } else {
        throw new Error('Unsupported stream format returned from provider');
    }
}

export async function POST(req: Request) {
    try {
        // 1. Rate Limiting (checked first)
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
        const rateLimitRes = await checkRateLimit(ip);
        if (!rateLimitRes.success) {
            return new Response(
                JSON.stringify({ error: "Too many requests. Please try again in a minute. (कृपया थोड़ी देर बाद पुनः प्रयास करें।)" }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-RateLimit-Limit': String(rateLimitRes.limit),
                        'X-RateLimit-Remaining': String(rateLimitRes.remaining),
                        'X-RateLimit-Reset': String(rateLimitRes.reset),
                    }
                }
            );
        }

        // 2. Parse request body
        const body = await req.json();
        const messages: UIMessage[] = body.messages ?? [];
        const userMessages = messages.filter(m => m.role === 'user');
        const lastUserMessage = userMessages[userMessages.length - 1];
        const queryText = getMessageText(lastUserMessage);


        // 3. Guardrails & PII Check (checked next, before LLM or search)
        const guardrailRes = checkGuardrails(queryText);
        if (!guardrailRes.safe) {
            return new Response(
                JSON.stringify({ error: guardrailRes.error }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 4. Retrieve Context (FAISS vector store search with Tavily fallback)
        const { context, citations } = await ragEngine.retrieveContext(queryText);

        // 5. Build Dynamic System Prompt with Language Instruction and Context
        const languageInstruction = body.languageInstruction
            ? `\n\nIMPORTANT: ${body.languageInstruction}`
            : '\n\nIMPORTANT: Always respond in English only.';

        const fullSystemPrompt = `${systemPrompt}
${languageInstruction}

STRICT INSTRUCTIONS:
1. Use the provided Context ONLY. If the Answer is not in the context, politely say you don't know in the target language.
2. The Context is provided in English/Hindi. You MUST TRANSLATE and SYNTHESIZE the answer into the target language defined above.
3. Be polite, formal, and accurate.
4. Keep the answer concise.
5. Do NOT include any source links/URLs in the text of your answer unless they are verified in the context or citations.

CONTEXT:
${context}
`;

        // 6. Map messages to format expected by routeChatStream
        const routerMessages = messages.map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: getMessageText(msg)
        }));

        // Execute failover stream selection
        const rawStream = await routeChatStream(routerMessages, undefined, fullSystemPrompt);

        // 7. Emit an AI SDK v6 UI message stream.
        // The frontend uses useChat + DefaultChatTransport (AI SDK v6), which
        // parses the v6 UI-message-stream (text-start / text-delta / text-end),
        // NOT the legacy v4 `0:"..."` data-stream protocol. Emitting v4 here
        // left message.parts empty on the client, so nothing rendered.
        //
        // Sources ride at the front of the same text part; MessageBubble splits
        // the ---SOURCES---...---END_SOURCES--- block back out of the text.
        const sourcesBlock = `---SOURCES---\n${JSON.stringify(
            citations.map((c: any) => ({ title: c.title || 'Source', url: c.url || '' }))
        )}\n---END_SOURCES---\n`;

        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                const id = 'assistant-text';
                writer.write({ type: 'text-start', id });
                writer.write({ type: 'text-delta', id, delta: sourcesBlock });
                try {
                    for await (const chunk of normalizeStream(rawStream)) {
                        if (chunk) writer.write({ type: 'text-delta', id, delta: chunk });
                    }
                } finally {
                    writer.write({ type: 'text-end', id });
                }
            },
            onError: (error: unknown) => {
                console.error('Chat stream error:', error);
                return error instanceof Error ? error.message : 'An error occurred while generating the response.';
            },
        });

        return createUIMessageStreamResponse({ stream });

    } catch (error: any) {
        console.error('Chat API Error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'An error occurred.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
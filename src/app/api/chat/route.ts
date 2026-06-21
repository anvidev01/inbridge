import { checkRateLimit } from '@/lib/ai/ratelimit';
import { checkGuardrails } from '@/lib/guardrails';
import { RAGEngine } from '@/lib/rag-engine';
import { routeChatStream } from '@/lib/ai/router';
import { systemPrompt } from '@/lib/ai/system-prompt';
import { UIMessage } from 'ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ragEngine = new RAGEngine();

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
        const queryText = lastUserMessage?.content || '';

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
            content: msg.content
        }));

        // Execute failover stream selection
        const rawStream = await routeChatStream(routerMessages, undefined, fullSystemPrompt);

        // 7. Construct Response Stream using Vercel AI SDK Data Stream protocol
        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
            async start(controller) {
                // Prep and send sources JSON block
                const sourcesBlock = `---SOURCES---\n${JSON.stringify(
                    citations.map(c => ({ title: c.title || 'Source', url: c.url || '' }))
                )}\n---END_SOURCES---\n`;
                
                controller.enqueue(encoder.encode(`0:${JSON.stringify(sourcesBlock)}\n`));

                try {
                    const textChunks = normalizeStream(rawStream);
                    for await (const chunk of textChunks) {
                        if (chunk) {
                            controller.enqueue(encoder.encode(`0:${JSON.stringify(chunk)}\n`));
                        }
                    }
                } catch (error: any) {
                    console.error("Stream pipe error:", error);
                    controller.enqueue(encoder.encode(`3:${JSON.stringify(error.message || 'Stream error')}\n`));
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'x-vercel-ai-data-stream': 'v1',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
            }
        });

    } catch (error: any) {
        console.error('Chat API Error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'An error occurred.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
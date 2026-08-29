import { checkRateLimit } from '@/lib/ai/ratelimit';
import { checkGuardrails } from '@/lib/guardrails';
import { RAGEngine } from '@/lib/rag-engine';
import { routeChatStream } from '@/lib/ai/router';
import { systemPrompt } from '@/lib/ai/system-prompt';
import { log } from '@/lib/observability/logger';
import { TelemetryBatch, classifyError } from '@/lib/observability/telemetry';
import { UIMessage } from 'ai';

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
    const requestStarted = Date.now();
    const telemetry = new TelemetryBatch();

    try {
        // 1. Rate Limiting (checked first)
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
        const rateLimitRes = await checkRateLimit(ip);
        if (!rateLimitRes.success) {
            log.warn('Chat request rate limited', { limit: rateLimitRes.limit });
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
            // The query itself is deliberately not logged: guardrails trip on
            // PII, so the offending text is exactly what must not reach logs.
            log.warn('Chat request blocked by guardrails', { query_chars: queryText.length });
            return new Response(
                JSON.stringify({ error: guardrailRes.error }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 4. Retrieve Context (FAISS vector store search with Tavily fallback)
        const { context, citations } = await ragEngine.retrieveContext(queryText, telemetry);

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
        const { stream: rawStream, provider, failovers } = await routeChatStream(
            routerMessages,
            undefined,
            fullSystemPrompt,
            telemetry
        );

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

                    log.info('Chat request completed', {
                        provider,
                        failovers,
                        duration_ms: Date.now() - requestStarted,
                    });
                } catch (error: any) {
                    // A provider can accept the connection and then fail mid-stream
                    // (auth rejected lazily, upstream 5xx, connection reset). The
                    // router already counted this attempt as a success when the
                    // stream opened, so record the mid-stream failure separately
                    // rather than leaving it invisible.
                    telemetry.llmError(provider, Date.now() - requestStarted, classifyError(error));
                    log.error('Chat stream failed mid-response', {
                        provider,
                        failovers,
                        duration_ms: Date.now() - requestStarted,
                        error,
                    });
                    controller.enqueue(encoder.encode(`3:${JSON.stringify(error.message || 'Stream error')}\n`));
                } finally {
                    // Close first, flush second: the reader already has the full
                    // answer, so the telemetry POST costs the user nothing. The
                    // await keeps the serverless invocation alive until the batch
                    // ships -- a detached promise is not guaranteed to run once
                    // the instance freezes. (On Vercel, waitUntil from
                    // @vercel/functions would be the cleaner primitive.)
                    controller.close();
                    await telemetry.flush();
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
        log.error('Chat request failed', {
            duration_ms: Date.now() - requestStarted,
            error,
        });
        // The request failed before streaming began, so nothing else will flush
        // the events collected so far (RAG retrieval, failed provider attempts).
        await telemetry.flush();

        return new Response(
            JSON.stringify({ error: error.message || 'An error occurred.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
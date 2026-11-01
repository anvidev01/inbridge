import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { abortError, maxOutputTokens, TEMPERATURE, type ProviderInput } from './generation';

/**
 * Groq via the AI SDK.
 *
 * Reads fullStream, not textStream: textStream silently drops error parts, so
 * a retired model id or a 429 used to produce an empty answer and no failover.
 */
export async function* streamGroq({ turns, system, signal }: ProviderInput): AsyncGenerator<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error('Groq API Key is missing. Please set GROQ_API_KEY in your environment.');
    }

    const groq = createGroq({ apiKey });
    // llama-3.3-70b-versatile was retired from Groq. The default id below has
    // not been checked against Groq's live model list from this repo; set
    // GROQ_MODEL to a model confirmed in the Groq console.
    const modelName = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

    const result = streamText({
        model: groq(modelName),
        system,
        messages: turns,
        temperature: TEMPERATURE,
        maxOutputTokens: maxOutputTokens(),
        abortSignal: signal,
        // Errors are rethrown from the loop below; the default handler would
        // only log them.
        onError: () => {},
    });

    for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
            if (part.text) yield part.text;
        } else if (part.type === 'error') {
            throw part.error instanceof Error ? part.error : new Error(String(part.error));
        } else if (part.type === 'abort') {
            throw abortError();
        }
    }
}

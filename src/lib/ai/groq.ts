import { createGroq, type GroqLanguageModelOptions } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { abortError, maxOutputTokens, TEMPERATURE, type ProviderInput } from './generation';

/**
 * Groq provider options that keep a reasoning model's thinking out of the
 * answer text. Option names and values are the ones @ai-sdk/groq accepts
 * (groqLanguageModelOptions: reasoningFormat, reasoningEffort), sent to Groq
 * as reasoning_format / reasoning_effort.
 *
 *  - qwen3: thinking is turned off (reasoningEffort 'none') and, should the
 *    model think anyway, hidden from the response (reasoningFormat 'hidden').
 *    Without this Groq's default for qwen3 is 'raw': <think> text inside the
 *    answer, counted against maxOutputTokens and delaying the first token.
 *  - qwq / deepseek-r1: thinking cannot be turned off, so it is hidden.
 *  - gpt-oss: reasoning already arrives in a separate field (reasoning parts,
 *    which streamGroq ignores) and these models do not take reasoning_format,
 *    so only the effort is lowered.
 *  - Any other model: no reasoning options, since Groq may reject them for
 *    models that do not reason.
 *
 * ThinkStripper in the router stays as a safety net either way.
 */
export function groqReasoningOptions(
    modelId: string
): Pick<GroqLanguageModelOptions, 'reasoningFormat' | 'reasoningEffort'> | undefined {
    const id = modelId.toLowerCase();
    if (/(^|\/)qwen3/.test(id)) return { reasoningFormat: 'hidden', reasoningEffort: 'none' };
    if (/qwq|deepseek-r1/.test(id)) return { reasoningFormat: 'hidden' };
    if (/(^|\/)gpt-oss/.test(id)) return { reasoningEffort: 'low' };
    return undefined;
}

/**
 * Groq via the AI SDK.
 *
 * Reads fullStream, not textStream: textStream silently drops error parts, so
 * a retired model id or a 429 used to produce an empty answer and no failover.
 */
export async function* streamGroq({ turns, system, signal, maxTokens }: ProviderInput): AsyncGenerator<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error('Groq API Key is missing. Please set GROQ_API_KEY in your environment.');
    }

    const groq = createGroq({ apiKey });
    // llama-3.3-70b-versatile was retired from Groq. The default id below has
    // not been checked against Groq's live model list from this repo; set
    // GROQ_MODEL to a model confirmed in the Groq console.
    const modelName = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

    const reasoning = groqReasoningOptions(modelName);
    const result = streamText({
        model: groq(modelName),
        ...(reasoning ? { providerOptions: { groq: reasoning } } : {}),
        system,
        messages: turns,
        temperature: TEMPERATURE,
        maxOutputTokens: maxTokens ?? maxOutputTokens(),
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

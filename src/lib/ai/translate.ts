import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { groqReasoningOptions } from './groq';
import { log } from '../observability/logger';

const TRANSLATE_TIMEOUT_MS = 4000;
const MAX_QUERY_CHARS = 200;

const SYSTEM = [
    'Rewrite the user question as a short English search query about Indian government schemes and services.',
    'Keep scheme names, states and numbers. Output only the query, with no quotes and no explanation.',
].join(' ');

/** Cleans a model reply into a single search line (drops reasoning blocks and quotes). */
export function cleanSearchQuery(raw: string): string {
    return raw
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0)
        ?.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
        .slice(0, MAX_QUERY_CHARS)
        .trim() ?? '';
}

/**
 * English search query for a question written in Devanagari, or null.
 *
 * Retrieval is English-only: the dataset snapshot and its embedding model are
 * English, and live search matches Hindi text poorly. The answer is still
 * written in the user's language; only the search uses this query. Any failure
 * (no key, timeout, empty reply) returns null and retrieval falls back to
 * sending Devanagari questions to live search.
 */
export async function englishSearchQuery(text: string, signal?: AbortSignal): Promise<string | null> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || !/[ऀ-ॿ]/.test(text)) return null;
    const modelName = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
    const reasoning = groqReasoningOptions(modelName);
    const timeout = AbortSignal.timeout(TRANSLATE_TIMEOUT_MS);
    try {
        const { text: out } = await generateText({
            model: createGroq({ apiKey })(modelName),
            ...(reasoning ? { providerOptions: { groq: reasoning } } : {}),
            system: SYSTEM,
            prompt: text,
            temperature: 0,
            maxOutputTokens: 80,
            abortSignal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
        const query = cleanSearchQuery(out);
        return query && !/[ऀ-ॿ]/.test(query) ? query : null;
    } catch (error) {
        log.warn('Search-query translation failed; using the original text', { error });
        return null;
    }
}

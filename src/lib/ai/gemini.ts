import { maxOutputTokens, TEMPERATURE, type ProviderInput } from './generation';

/**
 * Model used when GEMINI_MODEL is not set. Google retires model ids (the old
 * default, gemini-2.0-flash, answers 404 "no longer available"), so this is an
 * alias that always points at the current Flash-Lite model. Chosen by measuring
 * candidates through this adapter (GET /api/internal/providers?probe=1&gemini_models=...):
 * flash-lite answers in ~1 s; the full Flash models took 16 s to a first token or
 * returned 503 "high demand". Re-check there if answers get slow.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Finish reasons that mean the model refused or was cut off for a reason other than length. */
const BLOCKING_FINISH = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'LANGUAGE', 'OTHER']);

interface GeminiPart {
    text?: string;
    /** True for the model's hidden reasoning, which must never reach the user. */
    thought?: boolean;
}

interface GeminiEvent {
    candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
    error?: { code?: number; message?: string; status?: string };
}

/**
 * Text deltas from a Gemini server-sent-events stream (`alt=sse`).
 *
 * Why this is hand-written instead of using @google/generative-ai's stream: that
 * library failed mid-answer with "Failed to parse stream" on about half of the
 * Hindi and Hinglish answers (English was fine). Devanagari is multi-byte, and a
 * network chunk can end inside a character or inside an event. This reader
 *  - decodes with a streaming TextDecoder, so a split character is joined back,
 *  - buffers until a complete event (blank-line terminated, LF or CRLF),
 *  - ignores hidden "thought" parts,
 *  - surfaces an in-stream error or a blocked/refused response as an Error (so the
 *    router can fail over) instead of ending silently.
 *
 * Exported for tests.
 */
export async function* parseGeminiSse(body: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let yielded = false;

    function* events(final: boolean): Generator<GeminiEvent> {
        for (;;) {
            const match = /\r?\n\r?\n/.exec(buffer);
            if (!match) break;
            const raw = buffer.slice(0, match.index);
            buffer = buffer.slice(match.index + match[0].length);
            const event = parseEvent(raw);
            if (event) yield event;
        }
        if (final && buffer.trim()) {
            const event = parseEvent(buffer);
            buffer = '';
            if (event) yield event;
        }
    }

    function* handle(event: GeminiEvent): Generator<string> {
        if (event.error) {
            throw new Error(`Gemini stream error ${event.error.code ?? ''} ${event.error.status ?? ''}: ${event.error.message ?? ''}`.trim());
        }
        if (event.promptFeedback?.blockReason) {
            throw new Error(`Gemini blocked the request: ${event.promptFeedback.blockReason}`);
        }
        const candidate = event.candidates?.[0];
        for (const part of candidate?.content?.parts ?? []) {
            if (part.thought || !part.text) continue;
            yielded = true;
            yield part.text;
        }
        if (candidate?.finishReason && BLOCKING_FINISH.has(candidate.finishReason) && !yielded) {
            throw new Error(`Gemini stopped without an answer: ${candidate.finishReason}`);
        }
    }

    for await (const chunk of body) {
        buffer += decoder.decode(chunk, { stream: true });
        for (const event of events(false)) yield* handle(event);
    }
    buffer += decoder.decode();
    for (const event of events(true)) yield* handle(event);
}

/** The JSON payload of one SSE event, or null for comments and keep-alives. */
function parseEvent(raw: string): GeminiEvent | null {
    const data = raw
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n');
    if (!data || data === '[DONE]') return null;
    try {
        return JSON.parse(data) as GeminiEvent;
    } catch {
        throw new Error('Gemini sent an event that is not valid JSON');
    }
}

/** Gemini content stream. Errors surface from the iterator and are rethrown. */
export function streamGemini(input: ProviderInput): AsyncGenerator<string> {
    return streamGeminiWith(process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, input);
}

/** Same, with an explicit model (used to test candidate models). */
export async function* streamGeminiWith(modelName: string, { turns, system, signal }: ProviderInput): AsyncGenerator<string> {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Google Gemini API Key is missing. Please set GOOGLE_GEMINI_API_KEY in your environment.');
    }

    const res = await fetch(`${ENDPOINT}/${encodeURIComponent(modelName)}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        // The key goes in a header, never the URL, so it cannot end up in an error message or a log.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            // Gemini calls the assistant role "model".
            contents: turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
            generationConfig: { maxOutputTokens: maxOutputTokens(), temperature: TEMPERATURE },
        }),
        signal,
    });

    if (!res.ok || !res.body) {
        // The status code is kept in the message: classifyError reads "429" as a rate limit.
        const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
        throw new Error(`Gemini request failed: ${res.status} ${detail}`.trim());
    }

    yield* parseGeminiSse(res.body as unknown as AsyncIterable<Uint8Array>);
}

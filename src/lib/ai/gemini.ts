import { GoogleGenerativeAI } from '@google/generative-ai';
import { maxOutputTokens, TEMPERATURE, type ProviderInput } from './generation';

/**
 * Model used when GEMINI_MODEL is not set. Google retires model ids (the old
 * default, gemini-2.0-flash, now answers 404 "no longer available"), so this is
 * the alias that always points at the current Flash model. Check what a key can
 * use with GET /api/internal/providers?probe=1.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

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

    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: modelName,
        systemInstruction: system,
    });

    const result = await model.generateContentStream(
        {
            // Gemini calls the assistant role "model".
            contents: turns.map((t) => ({
                role: t.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: t.content }],
            })),
            generationConfig: { maxOutputTokens: maxOutputTokens(), temperature: TEMPERATURE },
        },
        { signal }
    );

    for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
    }
}

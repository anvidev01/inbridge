import { GoogleGenerativeAI } from '@google/generative-ai';
import { maxOutputTokens, TEMPERATURE, type ProviderInput } from './generation';

/** Gemini content stream. Errors surface from the iterator and are rethrown. */
export async function* streamGemini({ turns, system, signal }: ProviderInput): AsyncGenerator<string> {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Google Gemini API Key is missing. Please set GOOGLE_GEMINI_API_KEY in your environment.');
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
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

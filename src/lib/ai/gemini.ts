import { GoogleGenerativeAI } from '@google/generative-ai';
import { systemPrompt } from './system-prompt';

// Define expected interface
interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export async function createGeminiStream(messages: Message[], modelOverride?: string) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Google Gemini API Key is missing. Please set GOOGLE_GEMINI_API_KEY in your environment.');
    }

    const modelName = modelOverride || process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    const genAI = new GoogleGenerativeAI(apiKey);
    const maxTokens = parseInt(process.env.CHAT_MAX_TOKENS || '2048', 10);

    // Gemini uses systemInstruction
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt
    });

    // Convert generic messages to Gemini format
    const history = messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user', // Gemini uses "model" not "assistant"
        parts: [{ text: msg.content }],
    }));

    try {
        // We only pass the previous conversation history, and send the last user message as the prompt
        // Wait, the new API allows passing history directly to generateContentStream by using contents array
        const result = await model.generateContentStream({
            contents: history,
            generationConfig: {
                maxOutputTokens: maxTokens,
            }
        });

        return result.stream;
    } catch (error: any) {
        console.error("Gemini API stream error:", error);
        throw error;
    }
}

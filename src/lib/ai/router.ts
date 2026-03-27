import { createAnthropicStream } from './anthropic';
import { createGeminiStream } from './gemini';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export async function routeChatStream(messages: Message[], requestedProvider?: 'anthropic' | 'gemini') {
    const defaultProvider = process.env.ACTIVE_AI_PROVIDER || 'anthropic';
    const provider = requestedProvider || defaultProvider;

    if (provider === 'gemini') {
        try {
            return await createGeminiStream(messages);
        } catch (error) {
            console.error("Primary provider (Gemini) failed:", error);
            if (defaultProvider === 'both' && process.env.ANTHROPIC_API_KEY) {
                console.log("Falling back to Anthropic...");
                return createAnthropicStream(messages);
            }
            throw error;
        }
    }

    // Default to Anthropic
    try {
        return createAnthropicStream(messages);
    } catch (error) {
        console.error("Primary provider (Anthropic) failed:", error);
        if (defaultProvider === 'both' && process.env.GOOGLE_GEMINI_API_KEY) {
            console.log("Falling back to Gemini...");
            return await createGeminiStream(messages);
        }
        throw error;
    }
}

import { createAnthropicStream } from './anthropic';
import { createGeminiStream } from './gemini';
import { createGroqStream } from './groq';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export async function routeChatStream(
    messages: Message[],
    requestedProvider?: 'anthropic' | 'gemini' | 'groq',
    systemPromptOverride?: string
) {
    const defaultProvider = process.env.ACTIVE_AI_PROVIDER || 'anthropic';
    const provider = requestedProvider || defaultProvider;

    const tryAnthropic = async () => {
        if (process.env.ANTHROPIC_API_KEY) {
            console.log("Trying Anthropic stream...");
            return createAnthropicStream(messages, undefined, systemPromptOverride);
        }
        throw new Error("Anthropic key missing");
    };

    const tryGemini = async () => {
        if (process.env.GOOGLE_GEMINI_API_KEY) {
            console.log("Trying Gemini stream...");
            return await createGeminiStream(messages, undefined, systemPromptOverride);
        }
        throw new Error("Gemini key missing");
    };

    const tryGroq = async () => {
        if (process.env.GROQ_API_KEY) {
            console.log("Trying Groq stream...");
            return await createGroqStream(messages, undefined, systemPromptOverride);
        }
        throw new Error("Groq key missing");
    };

    if (provider === 'gemini') {
        try {
            return await tryGemini();
        } catch (error) {
            console.error("Primary provider (Gemini) failed:", error);
            if (defaultProvider === 'both') {
                try {
                    console.log("Falling back to Anthropic...");
                    return await tryAnthropic();
                } catch (fallbackError) {
                    console.error("Secondary fallback (Anthropic) failed:", fallbackError);
                }
            }
            try {
                console.log("Falling back to tertiary provider (Groq)...");
                return await tryGroq();
            } catch (tertiaryError) {
                console.error("Tertiary provider (Groq) failed:", tertiaryError);
                throw error;
            }
        }
    }

    if (provider === 'groq') {
        try {
            return await tryGroq();
        } catch (error) {
            console.error("Primary provider (Groq) failed:", error);
            try {
                console.log("Falling back to Anthropic...");
                return await tryAnthropic();
            } catch (fallbackError) {
                try {
                    console.log("Falling back to Gemini...");
                    return await tryGemini();
                } catch (tertiaryError) {
                    throw error;
                }
            }
        }
    }

    // Default to Anthropic
    try {
        return await tryAnthropic();
    } catch (error) {
        console.error("Primary provider (Anthropic) failed:", error);
        if (defaultProvider === 'both') {
            try {
                console.log("Falling back to Gemini...");
                return await tryGemini();
            } catch (fallbackError) {
                console.error("Secondary fallback (Gemini) failed:", fallbackError);
            }
        }
        try {
            console.log("Falling back to tertiary provider (Groq)...");
            return await tryGroq();
        } catch (tertiaryError) {
            console.error("Tertiary provider (Groq) failed:", tertiaryError);
            throw error;
        }
    }
}


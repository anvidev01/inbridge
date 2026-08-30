import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { systemPrompt as defaultSystemPrompt } from './system-prompt';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export async function createGroqStream(messages: Message[], modelOverride?: string, systemPromptOverride?: string) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error('Groq API Key is missing. Please set GROQ_API_KEY in your environment.');
    }

    const groq = createGroq({ apiKey });
    // llama-3.3-70b-versatile was retired from Groq; qwen3.8-27b is a current,
    // multilingual-capable replacement (important for InBridge's Hindi/regional
    // responses). Override with GROQ_MODEL.
    const modelName = modelOverride || process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
    const maxTokens = parseInt(process.env.CHAT_MAX_TOKENS || '2048', 10);
    const sysPrompt = systemPromptOverride || defaultSystemPrompt;

    // Convert message history for AI SDK
    const conversation = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
    }));

    try {
        const result = await streamText({
            model: groq(modelName),
            system: sysPrompt,
            messages: conversation,
        });

        return result.textStream;
    } catch (error: any) {
        console.error("Groq API stream error:", error);
        throw error;
    }
}

import Anthropic from '@anthropic-ai/sdk';
import { systemPrompt } from './system-prompt';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export function createAnthropicStream(messages: Message[], modelOverride?: string) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('Anthropic API Key is missing. Please set ANTHROPIC_API_KEY in your environment.');
    }

    const anthropic = new Anthropic({
        apiKey: apiKey,
    });

    const modelName = modelOverride || process.env.ANTHROPIC_MODEL || 'claude-opus-4-5';
    const maxTokens = parseInt(process.env.CHAT_MAX_TOKENS || '2048', 10);

    // Filter out system messages as Anthropic uses a top-level system parameter
    const conversation = messages
        .filter(m => m.role !== 'system')
        .map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
            content: msg.content
        }));

    try {
        const stream = anthropic.messages.stream({
            model: modelName,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: conversation,
        });

        return stream;
    } catch (error: any) {
        console.error("Anthropic API stream error:", error);
        throw error;
    }
}

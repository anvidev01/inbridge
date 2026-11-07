import Anthropic from '@anthropic-ai/sdk';
import { maxOutputTokens, TEMPERATURE, type ProviderInput } from './generation';

/** Anthropic Messages API stream. Errors surface from the iterator and are rethrown. */
export async function* streamAnthropic({ turns, system, signal, maxTokens }: ProviderInput): AsyncGenerator<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('Anthropic API Key is missing. Please set ANTHROPIC_API_KEY in your environment.');
    }

    const anthropic = new Anthropic({ apiKey });
    const modelName = process.env.ANTHROPIC_MODEL || 'claude-opus-4-5';

    const stream = anthropic.messages.stream(
        {
            model: modelName,
            max_tokens: maxTokens ?? maxOutputTokens(),
            temperature: TEMPERATURE,
            system,
            messages: turns.map((t) => ({ role: t.role, content: t.content })),
        },
        { signal }
    );

    for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta' && event.delta.text) {
            yield event.delta.text;
        }
    }
}

import { createAnthropicStream } from './anthropic';
import { createGeminiStream } from './gemini';
import { createGroqStream } from './groq';
import { buildChain, PREFERENCE_ORDER } from './chain';
import { log } from '../observability/logger';
import { TelemetryBatch, classifyError, type LLMProvider } from '../observability/telemetry';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface RoutedStream {
    /** The provider-specific stream object, normalised by the caller. */
    stream: unknown;
    /** Which provider actually produced the stream. */
    provider: LLMProvider;
    /** How many providers failed before this one succeeded. */
    failovers: number;
}

async function invoke(
    provider: LLMProvider,
    messages: Message[],
    systemPromptOverride?: string
): Promise<unknown> {
    switch (provider) {
        case 'anthropic':
            return createAnthropicStream(messages, undefined, systemPromptOverride);
        case 'gemini':
            return await createGeminiStream(messages, undefined, systemPromptOverride);
        case 'groq':
            return await createGroqStream(messages, undefined, systemPromptOverride);
    }
}

/**
 * Streams a chat completion, falling through the provider chain on failure.
 *
 * Emits one llm_request event per attempt and one llm_failover event per
 * transition into the telemetry batch, which the caller flushes.
 */
export async function routeChatStream(
    messages: Message[],
    requestedProvider?: LLMProvider,
    systemPromptOverride?: string,
    telemetry?: TelemetryBatch
): Promise<RoutedStream> {
    const chain = buildChain(requestedProvider);

    if (chain.length === 0) {
        log.error('No LLM provider is configured', {
            checked: PREFERENCE_ORDER,
        });
        throw new Error(
            'No LLM provider is configured. Set at least one of ANTHROPIC_API_KEY, GOOGLE_GEMINI_API_KEY or GROQ_API_KEY.'
        );
    }

    log.debug('LLM failover chain resolved', { chain, length: chain.length });

    let firstError: unknown = null;
    let failovers = 0;

    for (let i = 0; i < chain.length; i++) {
        const provider = chain[i];
        const started = Date.now();

        try {
            const stream = await invoke(provider, messages, systemPromptOverride);
            const elapsed = Date.now() - started;

            telemetry?.llmSuccess(provider, elapsed);
            log.info('LLM stream opened', { provider, duration_ms: elapsed, failovers });

            return { stream, provider, failovers };
        } catch (error) {
            const elapsed = Date.now() - started;
            const kind = classifyError(error);

            telemetry?.llmError(provider, elapsed, kind);
            log.warn('LLM provider failed', { provider, kind, duration_ms: elapsed, error });

            if (firstError === null) firstError = error;

            const next = chain[i + 1];
            if (next) {
                failovers++;
                telemetry?.failover(provider, next, kind);
                log.warn('Failing over to next provider', { from: provider, to: next, kind });
            }
        }
    }

    log.error('All LLM providers in the chain failed', { chain });
    // Surface the primary provider's error: it is the one an operator needs to
    // fix, and the downstream failures are usually the same outage.
    throw firstError ?? new Error('All LLM providers failed');
}

/**
 * LLM failover router.
 *
 * Provider streams fail lazily: the HTTP call, a 429 or a retired model id
 * only surface once the stream is iterated. The old router returned the
 * stream unread, so any of those produced an empty answer and no failover.
 * Now each provider is probed for its first non-empty text chunk before it is
 * committed to; anything that fails before that point falls through to the
 * next provider in the chain. After the first chunk the answer is already
 * visible to the user, so a later error is surfaced rather than retried.
 *
 * Chain order comes from chain.ts (providers without keys are skipped), and
 * providers whose circuit breaker is open in the Go backend are skipped via
 * provider-health.ts.
 */

import { log } from '../observability/logger';
import { classifyError, type LLMProvider, type TelemetryBatch } from '../observability/telemetry';
import { streamAnthropic } from './anthropic';
import { buildChain } from './chain';
import { streamGemini } from './gemini';
import { type ProviderInput, type ProviderStream } from './generation';
import { streamGroq } from './groq';
import { applyBreakerState, availableProviders } from './provider-health';
import { ThinkStripper } from './stream-filters';

/** Thrown when no provider is configured, or every provider failed before its first token. */
export class ProviderUnavailableError extends Error {
    constructor(message: string, readonly lastError?: unknown) {
        super(message);
        this.name = 'ProviderUnavailableError';
    }
}

export interface RouterDeps {
    providers: Record<LLMProvider, ProviderStream>;
    buildChain: (requested?: LLMProvider) => LLMProvider[];
    availableProviders: () => Promise<LLMProvider[] | null>;
    /** Time allowed for a provider's first token before failing over. */
    firstTokenTimeoutMs: number;
}

const DEFAULT_DEPS: RouterDeps = {
    providers: { anthropic: streamAnthropic, gemini: streamGemini, groq: streamGroq },
    buildChain: (requested) => buildChain(requested),
    availableProviders,
    // Three providers x 15s still fits inside the route's 60s maxDuration.
    firstTokenTimeoutMs: Number(process.env.LLM_FIRST_TOKEN_TIMEOUT_MS || 15000),
};

export interface RouteOptions {
    requestedProvider?: LLMProvider;
    telemetry?: TelemetryBatch;
}

export interface RoutedStream {
    provider: LLMProvider;
    /** Answer text, <think> blocks removed, starting with the probed first chunk. */
    stream: AsyncIterable<string>;
}

/** True when no provider has an API key; lets the route answer 503 before streaming. */
export function noProviderConfigured(deps: Pick<RouterDeps, 'buildChain'> = DEFAULT_DEPS): boolean {
    return deps.buildChain().length === 0;
}

class FirstTokenTimeout extends Error {
    constructor() {
        super('first token timed out');
        this.name = 'FirstTokenTimeout';
    }
}

export async function routeChatStream(
    input: ProviderInput,
    options: RouteOptions = {},
    deps: RouterDeps = DEFAULT_DEPS
): Promise<RoutedStream> {
    const configured = deps.buildChain(options.requestedProvider);
    if (configured.length === 0) {
        throw new ProviderUnavailableError('No LLM provider is configured');
    }

    const { chain, skipped } = applyBreakerState(configured, await deps.availableProviders());
    if (skipped.length > 0) {
        log.info('Skipping providers with open circuit breakers', { skipped });
    }

    let lastError: unknown;
    for (let i = 0; i < chain.length; i++) {
        const provider = chain[i];
        const started = Date.now();

        // One controller per attempt, so a first-token timeout can cancel this
        // provider's request without cancelling the user's whole request.
        const controller = new AbortController();
        const onUserAbort = () => controller.abort();
        input.signal?.addEventListener('abort', onUserAbort, { once: true });
        const detach = () => input.signal?.removeEventListener('abort', onUserAbort);

        const iterator = deps.providers[provider]({ ...input, signal: controller.signal })[Symbol.asyncIterator]();
        const stripper = new ThinkStripper();
        let timer: ReturnType<typeof setTimeout> | undefined;

        try {
            if (input.signal?.aborted) throw input.signal.reason ?? new Error('aborted');
            const timeout = new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                    controller.abort();
                    reject(new FirstTokenTimeout());
                }, deps.firstTokenTimeoutMs);
            });
            const first = await Promise.race([probeFirstText(iterator, stripper), timeout]);
            clearTimeout(timer);

            options.telemetry?.llmSuccess(provider, Date.now() - started);
            log.info('LLM provider streaming', { provider, first_token_ms: Date.now() - started });
            return { provider, stream: continueStream(first, iterator, stripper, detach) };
        } catch (error) {
            clearTimeout(timer);
            detach();
            controller.abort();
            void iterator.return?.(undefined)?.catch(() => {});

            // The user pressed Stop (or left): not a provider failure, no failover.
            if (input.signal?.aborted) throw error;

            const kind = error instanceof FirstTokenTimeout ? 'timeout' : classifyError(error);
            options.telemetry?.llmError(provider, Date.now() - started, kind);
            log.warn('LLM provider failed before first token', { provider, kind, error });

            const next = chain[i + 1];
            if (next) options.telemetry?.failover(provider, next, kind);
            lastError = error;
        }
    }

    throw new ProviderUnavailableError('Every LLM provider failed', lastError);
}

/** Reads until the first non-whitespace answer text; throws if the stream ends empty. */
async function probeFirstText(iterator: AsyncIterator<string>, stripper: ThinkStripper): Promise<string> {
    for (;;) {
        const { value, done } = await iterator.next();
        if (done) {
            const rest = stripper.flush().trimStart();
            if (rest) return rest;
            throw new Error('Provider returned an empty response');
        }
        const text = stripper.push(value).trimStart();
        if (text) return text;
    }
}

async function* continueStream(
    first: string,
    iterator: AsyncIterator<string>,
    stripper: ThinkStripper,
    detach: () => void
): AsyncGenerator<string> {
    try {
        yield first;
        for (;;) {
            const { value, done } = await iterator.next();
            if (done) break;
            const text = stripper.push(value);
            if (text) yield text;
        }
        const rest = stripper.flush();
        if (rest) yield rest;
    } finally {
        detach();
        // Stops the provider request if the consumer quit early.
        void iterator.return?.(undefined)?.catch(() => {});
    }
}

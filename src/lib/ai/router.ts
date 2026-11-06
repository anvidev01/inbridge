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
    /**
     * Most time any one provider gets for its first token before failing
     * over. The real limit per attempt is the smaller of this and the time
     * left before RouteOptions.firstTokenDeadline.
     */
    firstTokenTimeoutMs: number;
    /**
     * Longest silence tolerated between two pieces of an answer once it has started.
     * Without it a provider that stalls mid-answer leaves the user waiting until the
     * platform kills the request. Defaults to DEFAULT_STREAM_IDLE_TIMEOUT_MS.
     */
    streamIdleTimeoutMs?: number;
}

/** Default for RouterDeps.streamIdleTimeoutMs. Providers send a piece every fraction of a second. */
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 20_000;

export class StreamStalled extends Error {
    constructor(ms: number) {
        super(`provider stream stalled: no data for ${Math.round(ms / 1000)}s`);
        this.name = 'StreamStalled';
    }
}

/**
 * Default per-provider first-token cap. Override with LLM_FIRST_TOKEN_TIMEOUT_MS.
 * 18 s leaves room for the AI SDK's own retry-with-backoff on a 429 (Groq's
 * free tier limits tokens per minute), which can sleep for several seconds
 * before the first token. The request deadline still bounds the total so the
 * route ends inside Vercel's 60 s; a retry of a lone provider (see attemptPlan)
 * simply gets whatever is left of it.
 */
export const DEFAULT_FIRST_TOKEN_TIMEOUT_MS = 18_000;

/**
 * The providers to try, in order. Each is tried once, except that a lone
 * provider gets a second attempt: with nothing to fail over to, a single slow
 * or rate-limited response would otherwise surface as "service busy", yet a
 * fresh request right after such a blip usually succeeds. Exported for tests.
 */
export function attemptPlan(chain: LLMProvider[]): LLMProvider[] {
    return chain.length === 1 ? [chain[0], chain[0]] : chain;
}

function envTimeout(): number {
    const n = Number(process.env.LLM_FIRST_TOKEN_TIMEOUT_MS);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_FIRST_TOKEN_TIMEOUT_MS;
}

const DEFAULT_DEPS: RouterDeps = {
    providers: { anthropic: streamAnthropic, gemini: streamGemini, groq: streamGroq },
    buildChain: (requested) => buildChain(requested),
    availableProviders,
    // A per-provider cap only. Retrieval runs before the router and is not
    // covered by it; the route passes firstTokenDeadline so retrieval time
    // plus every failover attempt still leaves room to generate the answer
    // inside the function's maxDuration.
    firstTokenTimeoutMs: envTimeout(),
};

export interface RouteOptions {
    requestedProvider?: LLMProvider;
    telemetry?: TelemetryBatch;
    /**
     * Epoch ms by which some provider must have produced its first token.
     * Each attempt gets min(firstTokenTimeoutMs, time left); once the deadline
     * has passed no further provider is tried. Build it with firstTokenDeadline.
     */
    firstTokenDeadline?: number;
    /** Reports progress (see observability/trace.ts). Never throws into the router. */
    onStage?: (stage: string, detail?: string) => void;
}

/**
 * Deadline for the first token: route start + the function's maxDuration,
 * minus the time reserved for generating the rest of the answer after the
 * first token arrives.
 */
export function firstTokenDeadline(routeStartedAt: number, maxDurationMs: number, generationReserveMs: number): number {
    return routeStartedAt + maxDurationMs - generationReserveMs;
}

/** Time the next attempt may wait for its first token: min(cap, time left), never negative. */
export function attemptTimeoutMs(capMs: number, deadline: number | undefined, now: number): number {
    if (deadline === undefined) return capMs;
    return Math.max(0, Math.min(capMs, deadline - now));
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

    options.onStage?.('router-start');
    const available = await deps.availableProviders();
    options.onStage?.('providers-checked');
    const { chain, skipped } = applyBreakerState(configured, available);
    if (skipped.length > 0) {
        log.info('Skipping providers with open circuit breakers', { skipped });
    }

    const plan = attemptPlan(chain);
    let lastError: unknown;
    for (let i = 0; i < plan.length; i++) {
        const provider = plan[i];
        const started = Date.now();
        options.onStage?.('attempt', provider);

        const timeoutMs = attemptTimeoutMs(deps.firstTokenTimeoutMs, options.firstTokenDeadline, started);
        if (timeoutMs <= 0) {
            log.warn('First-token deadline passed; not trying further providers', {
                skipped: plan.slice(i),
            });
            break;
        }

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
                }, timeoutMs);
            });
            const first = await Promise.race([probeFirstText(iterator, stripper), timeout]);
            clearTimeout(timer);

            options.onStage?.('first-token', provider);
            options.telemetry?.llmSuccess(provider, Date.now() - started);
            log.info('LLM provider streaming', { provider, first_token_ms: Date.now() - started });
            return {
                provider,
                stream: continueStream(
                    first,
                    iterator,
                    stripper,
                    detach,
                    deps.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS,
                    () => controller.abort()
                ),
            };
        } catch (error) {
            clearTimeout(timer);
            detach();
            controller.abort();
            void iterator.return?.(undefined)?.catch(() => {});

            // The user pressed Stop (or left): not a provider failure, no failover.
            if (input.signal?.aborted) throw error;

            const kind = error instanceof FirstTokenTimeout ? 'timeout' : classifyError(error);
            options.onStage?.('attempt-failed', `${provider}:${kind}`);
            // A timeout that only fired because the request's own deadline
            // shortened the wait says nothing about the provider's health, so
            // it is not reported to telemetry (which feeds the circuit breakers).
            const cutByDeadline = error instanceof FirstTokenTimeout && timeoutMs < deps.firstTokenTimeoutMs;
            if (!cutByDeadline) options.telemetry?.llmError(provider, Date.now() - started, kind);
            log.warn('LLM provider failed before first token', { provider, kind, cut_by_deadline: cutByDeadline, error });

            // A retry of the same provider is not a failover to another one.
            const next = plan[i + 1];
            if (next && next !== provider) options.telemetry?.failover(provider, next, kind);
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

/** iterator.next() that gives up if nothing arrives within `ms`. */
async function nextWithIdleTimeout<T>(iterator: AsyncIterator<T>, ms: number): Promise<IteratorResult<T>> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stalled = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new StreamStalled(ms)), ms);
    });
    try {
        return await Promise.race([iterator.next(), stalled]);
    } finally {
        clearTimeout(timer);
    }
}

async function* continueStream(
    first: string,
    iterator: AsyncIterator<string>,
    stripper: ThinkStripper,
    detach: () => void,
    idleMs: number,
    abortUpstream: () => void
): AsyncGenerator<string> {
    try {
        yield first;
        for (;;) {
            const { value, done } = await nextWithIdleTimeout(iterator, idleMs);
            if (done) break;
            const text = stripper.push(value);
            if (text) yield text;
        }
        const rest = stripper.flush();
        if (rest) yield rest;
    } catch (error) {
        // A stalled provider request is cancelled, not left running.
        if (error instanceof StreamStalled) abortUpstream();
        throw error;
    } finally {
        detach();
        // Stops the provider request if the consumer quit early.
        void iterator.return?.(undefined)?.catch(() => {});
    }
}

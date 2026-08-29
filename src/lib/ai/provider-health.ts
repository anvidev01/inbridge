/**
 * Reads LLM provider circuit-breaker state from the Go backend.
 *
 * The breakers live in the Go process (see backend/circuit/providers.go) because
 * this runtime is ephemeral: consecutive-failure counts kept here would reset on
 * every cold start and never trip. This module is the read side -- the router
 * asks which providers are currently worth attempting, and skips the ones whose
 * breaker is open instead of paying their full timeout before failing over.
 */

import type { LLMProvider } from '../observability/telemetry';
import { log } from '../observability/logger';

/**
 * How long an availability answer is reused.
 *
 * Short enough that a recovered provider is picked up quickly, long enough that
 * a burst of chat traffic does not issue one backend call per request. The
 * breaker's own open timeout is 20s, so 5s cannot hide a full recovery cycle.
 */
const CACHE_TTL_MS = Number(process.env.PROVIDER_HEALTH_TTL_MS || 5000);

/**
 * Deadline for the lookup. This sits on the chat hot path, so it is far tighter
 * than the telemetry flush: an unresponsive backend must cost milliseconds, not
 * seconds, before the router gives up and tries everything.
 */
const LOOKUP_TIMEOUT_MS = 500;

interface CacheEntry {
    available: LLMProvider[];
    expiresAt: number;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<LLMProvider[] | null> | null = null;

function healthURL(): string | null {
    const base = process.env.INTERNAL_METRICS_URL || process.env.NEXT_PUBLIC_API_URL || '';
    if (!base) return null;
    return `${base.replace(/\/+$/, '')}/internal/llm/providers`;
}

/**
 * Returns the providers whose breakers are closed, or null when the answer is
 * unknown.
 *
 * Null is the fail-open signal and every failure path returns it: unset config,
 * timeout, non-200, malformed body. A degraded breaker service must never be
 * able to stop chat from being served -- the worst case of guessing wrong is
 * one wasted provider attempt, while the worst case of failing closed is a
 * total outage caused by the thing meant to prevent one.
 */
export async function availableProviders(): Promise<LLMProvider[] | null> {
    if (cache && Date.now() < cache.expiresAt) {
        return cache.available;
    }

    // Collapse concurrent lookups: under load every in-flight chat request would
    // otherwise issue its own call the moment the cache expires.
    if (inFlight) return inFlight;

    inFlight = lookup().finally(() => {
        inFlight = null;
    });

    return inFlight;
}

async function lookup(): Promise<LLMProvider[] | null> {
    const url = healthURL();
    const token = process.env.INTERNAL_API_TOKEN;
    if (!url || !token) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

    try {
        const res = await fetch(url, {
            headers: { 'X-Internal-Token': token },
            signal: controller.signal,
            cache: 'no-store',
        });

        if (!res.ok) {
            log.warn('Provider health lookup returned non-200', { status: res.status });
            return null;
        }

        const body = (await res.json()) as { available?: unknown };
        if (!Array.isArray(body.available)) {
            log.warn('Provider health response missing available[]');
            return null;
        }

        const available = body.available.filter((p): p is LLMProvider => typeof p === 'string');
        cache = { available, expiresAt: Date.now() + CACHE_TTL_MS };
        return available;
    } catch (error) {
        log.warn('Provider health lookup failed — assuming all providers available', { error });
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/** Clears the cached answer. Exported for tests. */
export function resetProviderHealthCache(): void {
    cache = null;
    inFlight = null;
}

/**
 * Removes providers whose breaker is open from an ordered chain.
 *
 * If filtering would empty the chain, the original is returned: with every
 * breaker open there is nothing to lose by trying, and returning an empty chain
 * would turn a degraded service into a hard failure.
 */
export function applyBreakerState(
    chain: LLMProvider[],
    available: LLMProvider[] | null
): { chain: LLMProvider[]; skipped: LLMProvider[] } {
    if (available === null) return { chain, skipped: [] };

    const allowed = new Set(available);
    const filtered = chain.filter((p) => allowed.has(p));

    if (filtered.length === 0) return { chain, skipped: [] };

    return { chain: filtered, skipped: chain.filter((p) => !allowed.has(p)) };
}

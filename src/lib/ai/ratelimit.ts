/**
 * Fixed-window rate limiter, in memory.
 *
 * Limits are per serverless instance: on Vercel each warm instance keeps its
 * own map and a cold start resets it, so this caps bursts from one client but
 * is not a global quota.
 *
 * Retention: a key (the client IP) is kept only for its current window.
 * Expired keys are evicted on requests and by an unref'd background timer,
 * at most SWEEP_INTERVAL_MS after the window ends. Nothing is persisted.
 *
 * TODO(upstash): when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are
 * set, use @upstash/ratelimit (sliding window) for a limit shared across
 * instances, and keep this as the fallback. Not done here because it needs
 * the @upstash/ratelimit and @upstash/redis dependencies, which are not
 * installed. Note the Go backend's REDIS_URL (rediss://) is not a REST
 * endpoint and cannot be used by that client.
 */

interface RateLimitTracker {
    count: number;
    resetAt: number;
}

export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
}

/** Length of one rate-limit window. Exported so tests and docs agree on it. */
export const WINDOW_MS = 60 * 1000;
/**
 * Expired entries are swept at least this often, both on incoming requests
 * and by a background timer, so an IP is held for at most WINDOW_MS +
 * SWEEP_INTERVAL_MS after its first request in a window, even when no
 * further traffic arrives.
 */
export const SWEEP_INTERVAL_MS = 10 * 1000;
/** Hard cap so a flood of distinct keys cannot grow the map without bound. */
const MAX_TRACKED_KEYS = 10_000;

const rateLimits = new Map<string, RateLimitTracker>();
let lastSweep = 0;
let sweepTimer: ReturnType<typeof setInterval> | undefined;

/**
 * Deletes every entry whose window has ended. Returns how many were removed.
 * Exported for tests.
 */
export function evictExpired(now: number = Date.now()): number {
    lastSweep = now;
    let removed = 0;
    for (const [key, record] of rateLimits) {
        if (now >= record.resetAt) {
            rateLimits.delete(key);
            removed++;
        }
    }
    if (rateLimits.size === 0) stopSweepTimer();
    return removed;
}

function sweep(now: number): void {
    if (now - lastSweep >= SWEEP_INTERVAL_MS || rateLimits.size >= MAX_TRACKED_KEYS) evictExpired(now);
    // Still over the cap: drop the oldest insertions (Map iterates in insertion order).
    if (rateLimits.size >= MAX_TRACKED_KEYS) {
        let excess = rateLimits.size - MAX_TRACKED_KEYS + 1;
        for (const key of rateLimits.keys()) {
            if (excess-- <= 0) break;
            rateLimits.delete(key);
        }
    }
}

/**
 * Runs evictExpired in the background while anything is tracked. unref()
 * keeps the timer from holding a Node process (or a test run) open.
 */
function ensureSweepTimer(): void {
    if (sweepTimer) return;
    sweepTimer = setInterval(() => evictExpired(), SWEEP_INTERVAL_MS);
    (sweepTimer as { unref?: () => void }).unref?.();
}

function stopSweepTimer(): void {
    if (!sweepTimer) return;
    clearInterval(sweepTimer);
    sweepTimer = undefined;
}

/** True while the background sweep is scheduled. Exported for tests. */
export function sweepTimerActive(): boolean {
    return sweepTimer !== undefined;
}

/**
 * Counts one request for `key` (an IP, optionally namespaced such as
 * "feedback:1.2.3.4") against `limit` requests per minute.
 */
export async function checkRateLimit(key: string, limit?: number): Promise<RateLimitResult> {
    const max = limit ?? parseInt(process.env.CHAT_RATE_LIMIT_PER_MIN || '20', 10);
    const now = Date.now();
    sweep(now);

    let record = rateLimits.get(key);
    if (!record || now >= record.resetAt) {
        // Re-insert so Map order stays oldest-first for the cap eviction.
        rateLimits.delete(key);
        record = { count: 1, resetAt: now + WINDOW_MS };
        rateLimits.set(key, record);
        ensureSweepTimer();
        return { success: true, limit: max, remaining: max - 1, reset: record.resetAt };
    }

    if (record.count >= max) {
        return { success: false, limit: max, remaining: 0, reset: record.resetAt };
    }

    record.count += 1;
    return { success: true, limit: max, remaining: max - record.count, reset: record.resetAt };
}

/**
 * Client IP for rate-limit keys. On Vercel the first x-forwarded-for entry is
 * set by the platform; elsewhere it is client-controlled, so treat the limit
 * as best-effort.
 */
export function clientIp(headers: Headers): string {
    return (
        headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        headers.get('x-real-ip')?.trim() ||
        '127.0.0.1'
    );
}

/** Number of keys currently tracked. Exported for tests. */
export function trackedKeyCount(): number {
    return rateLimits.size;
}

/** Clears all state. Exported for tests. */
export function resetRateLimits(): void {
    rateLimits.clear();
    lastSweep = 0;
    stopSweepTimer();
}

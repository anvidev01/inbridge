/**
 * Tavily usage tracking (server-side only).
 *
 * Reports each Tavily search -- credits, latency, success/failure -- to the Go
 * backend (POST /internal/telemetry/tavily), which stores it in Postgres. Uses the
 * same INTERNAL_API_TOKEN channel as telemetry.ts, so neither the Tavily key nor
 * the usage data ever reaches the browser.
 *
 * Tracking must never affect the search or chat flow: everything here is
 * best-effort and swallows its own errors.
 */

import { after } from 'next/server';
import { log } from './logger';
import { classifyError, type LLMErrorKind } from './telemetry';

export interface TavilyUsageRecord {
    success: boolean;
    credits: number;
    latency_ms: number;
    search_depth?: string;
    result_count: number;
    error_kind?: LLMErrorKind;
    request_id?: string;
}

const TIMEOUT_MS = 2000;

async function send(record: TavilyUsageRecord): Promise<void> {
    const base = process.env.INTERNAL_METRICS_URL || process.env.NEXT_PUBLIC_API_URL || '';
    const token = process.env.INTERNAL_API_TOKEN;
    if (!base || !token) return; // telemetry.ts already warns once about this

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${base.replace(/\/+$/, '')}/internal/telemetry/tavily`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Token': token },
            body: JSON.stringify(record),
            signal: controller.signal,
            cache: 'no-store',
        });
        if (!res.ok) log.warn('Tavily usage ingest rejected record', { status: res.status });
    } catch (error) {
        log.warn('Tavily usage report failed', { error });
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Schedules the report without delaying the caller. `after()` keeps the work
 * alive past the response on Vercel; outside a request scope (tests, scripts) it
 * throws, so fall back to a plain detached promise.
 */
export function trackTavilyUsage(record: TavilyUsageRecord): void {
    try {
        try {
            after(() => send(record));
        } catch {
            void send(record);
        }
    } catch {
        /* never let tracking break search */
    }
}

/** Builds a record from a Tavily response (or error) -- pure, no I/O. */
export function buildTavilyRecord(args: {
    startedAt: number;
    searchDepth: string;
    response?: { results?: unknown[]; usage?: { credits?: number }; requestId?: string };
    error?: unknown;
}): TavilyUsageRecord {
    const { startedAt, searchDepth, response, error } = args;
    const failed = error !== undefined;
    return {
        success: !failed,
        credits: Number(response?.usage?.credits) || 0,
        latency_ms: Math.round(Date.now() - startedAt),
        search_depth: searchDepth,
        result_count: Array.isArray(response?.results) ? response!.results!.length : 0,
        error_kind: failed ? classifyError(error) : undefined,
        request_id: response?.requestId,
    };
}

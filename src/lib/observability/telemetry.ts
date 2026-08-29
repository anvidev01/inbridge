/**
 * Fire-and-forget telemetry emitter for the chat plane.
 *
 * Why events are shipped to Go rather than counted here
 * ─────────────────────────────────────────────────────
 * The Next.js route runs per-request and is ephemeral on Vercel, so an
 * in-process Prometheus counter would reset on every cold start and `rate()`
 * over it would be meaningless. The Go backend owns the registry Prometheus
 * scrapes, and its alerter reads LLMFailoversTotal from that same registry --
 * a counter held here could never fire the failover-spike alert.
 *
 * Contract: POST /internal/telemetry/llm with the X-Internal-Token header.
 * See backend/handlers/telemetry.go for the accepted label allowlists.
 */

import { log } from './logger';

export type LLMProvider = 'anthropic' | 'gemini' | 'groq';

/** Mirrors allowedErrorKinds in backend/handlers/telemetry.go. */
export type LLMErrorKind = 'missing_key' | 'api_error' | 'timeout' | 'rate_limit' | 'unknown';

/** Mirrors allowedRAGSources in backend/handlers/telemetry.go. */
export type RAGSource = 'cache' | 'vector_store' | 'tavily_search' | 'llm_direct';

export type TelemetryEvent =
    | {
          type: 'llm_request';
          provider: LLMProvider;
          outcome: 'success' | 'error';
          duration_ms?: number;
          kind?: LLMErrorKind;
      }
    | { type: 'llm_failover'; from: LLMProvider; to: LLMProvider; kind?: LLMErrorKind }
    | { type: 'rag_cache'; result: 'hit' | 'miss'; source?: RAGSource; duration_ms?: number };

/** Deadline for the ingest POST. Matches telemetryClientTimeout in the Go handler. */
const FLUSH_TIMEOUT_MS = 2000;

function ingestURL(): string | null {
    const base =
        process.env.INTERNAL_METRICS_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        '';
    if (!base) return null;
    return `${base.replace(/\/+$/, '')}/internal/telemetry/llm`;
}

let disabledWarningLogged = false;

/**
 * Collects events for a single chat request and ships them in one POST.
 *
 * Instances are per-request: module-level buffering would interleave events
 * from concurrent requests and lose whatever is buffered when the lambda
 * freezes between invocations.
 */
export class TelemetryBatch {
    private events: TelemetryEvent[] = [];

    record(event: TelemetryEvent): void {
        this.events.push(event);
    }

    /** Convenience helpers keep call sites at the point of the actual event. */
    llmSuccess(provider: LLMProvider, durationMs: number): void {
        this.record({ type: 'llm_request', provider, outcome: 'success', duration_ms: Math.round(durationMs) });
    }

    llmError(provider: LLMProvider, durationMs: number, kind: LLMErrorKind): void {
        this.record({ type: 'llm_request', provider, outcome: 'error', duration_ms: Math.round(durationMs), kind });
    }

    failover(from: LLMProvider, to: LLMProvider, kind: LLMErrorKind): void {
        this.record({ type: 'llm_failover', from, to, kind });
    }

    ragCache(result: 'hit' | 'miss', source: RAGSource, durationMs: number): void {
        this.record({ type: 'rag_cache', result, source, duration_ms: Math.round(durationMs) });
    }

    get size(): number {
        return this.events.length;
    }

    /**
     * Ships the batch. Never throws and never rejects: telemetry must not be able
     * to fail the chat request that produced it.
     *
     * Callers should await this before returning on serverless runtimes -- a
     * detached promise is not guaranteed to run once the response is sent and the
     * instance is frozen. The 2s deadline bounds the cost of doing so.
     */
    async flush(): Promise<void> {
        if (this.events.length === 0) return;

        const url = ingestURL();
        const token = process.env.INTERNAL_API_TOKEN;

        if (!url || !token) {
            if (!disabledWarningLogged) {
                disabledWarningLogged = true;
                log.warn('Telemetry disabled — set INTERNAL_METRICS_URL (or NEXT_PUBLIC_API_URL) and INTERNAL_API_TOKEN', {
                    has_url: Boolean(url),
                    has_token: Boolean(token),
                });
            }
            this.events = [];
            return;
        }

        const batch = this.events;
        this.events = [];

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FLUSH_TIMEOUT_MS);

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Token': token,
                },
                body: JSON.stringify({ events: batch }),
                signal: controller.signal,
                cache: 'no-store',
            });

            if (!res.ok) {
                log.warn('Telemetry ingest rejected batch', { status: res.status, events: batch.length });
            }
        } catch (error) {
            log.warn('Telemetry flush failed', { error, events: batch.length });
        } finally {
            clearTimeout(timer);
        }
    }
}

/** Classifies a provider error into one of the Go handler's bounded label values. */
export function classifyError(error: unknown): LLMErrorKind {
    const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();

    if (message.includes('key missing') || message.includes('api key is missing')) return 'missing_key';
    if (message.includes('rate limit') || message.includes('429') || message.includes('quota')) return 'rate_limit';
    if (message.includes('timeout') || message.includes('timed out') || message.includes('etimedout')) return 'timeout';
    if (message) return 'api_error';
    return 'unknown';
}

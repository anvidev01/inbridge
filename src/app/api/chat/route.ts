import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { buildRetrievalQuery, latestUserText, parseChatRequest } from '@/lib/ai/chat-request';
import { buildSources } from '@/lib/ai/citations';
import { checkRateLimit, clientIp, type RateLimitResult } from '@/lib/ai/ratelimit';
import {
    firstTokenDeadline,
    noProviderConfigured,
    ProviderUnavailableError,
    routeChatStream,
} from '@/lib/ai/router';
import { DashRewriter, FollowupSplitter, fixedFollowups, parseFollowups, rewriteDashes } from '@/lib/ai/stream-filters';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import { chatError } from '@/lib/ai/user-copy';
import {
    isChatMode,
    isLanguage,
    type ChatErrorCode,
    type Citation,
    type InBridgeUIMessage,
    type Language,
    type Provenance,
} from '@/lib/chat/protocol';
import { checkGuardrails, hasInjection, maskPII, type GuardrailKind } from '@/lib/guardrails';
import { log } from '@/lib/observability/logger';
import { TelemetryBatch } from '@/lib/observability/telemetry';
import { DATASET_LABEL, RAGEngine, type RetrievedContext } from '@/lib/rag-engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Time kept back from maxDuration for generating the answer after its first
 * token (up to CHAT_MAX_TOKENS of streaming). Retrieval and every failover
 * attempt must fit in what is left, so a slow retrieval shortens the
 * first-token wait instead of pushing the function past maxDuration.
 */
const GENERATION_RESERVE_MS = 25_000;

const ragEngine = new RAGEngine();

/** Requests larger than this are rejected before parsing. */
const MAX_BODY_BYTES = 256 * 1024;

const STATUS: Record<ChatErrorCode, number> = {
    bad_request: 400,
    guardrail: 400,
    rate_limited: 429,
    provider_unavailable: 503,
    server_error: 500,
};

function errorResponse(
    code: ChatErrorCode,
    language: Language,
    options: { guardrail?: GuardrailKind; rateLimit?: RateLimitResult } = {}
): Response {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.rateLimit) {
        const { limit, remaining, reset } = options.rateLimit;
        headers['X-RateLimit-Limit'] = String(limit);
        headers['X-RateLimit-Remaining'] = String(remaining);
        headers['X-RateLimit-Reset'] = String(reset);
        headers['Retry-After'] = String(Math.max(1, Math.ceil((reset - Date.now()) / 1000)));
    }
    return new Response(JSON.stringify(chatError(code, language, options.guardrail)), {
        status: STATUS[code],
        headers,
    });
}

/**
 * POST /api/chat
 *
 * Body: { messages, language, mode?, focus? } (see ChatRequestExtras in
 * src/lib/chat/protocol.ts). Streams an AI SDK v6 UI message:
 *   start (metadata: createdAt, mode, language) -> data-phase (transient, real phases only)
 *   -> data-sources + data-provenance -> text -> data-followups -> finish
 *
 * Every non-200 is a ChatErrorBody. An error after streaming has started is
 * sent as the stream's errorText, which is the same JSON, so the client can
 * parse error.message identically in both cases.
 */
export async function POST(req: Request) {
    const routeStartedAt = Date.now();
    let language: Language = 'en';
    try {
        const declaredLength = Number(req.headers.get('content-length') || 0);
        if (declaredLength > MAX_BODY_BYTES) return errorResponse('bad_request', language);

        let body: unknown;
        try {
            const raw = await req.text();
            if (raw.length > MAX_BODY_BYTES) return errorResponse('bad_request', language);
            body = JSON.parse(raw);
        } catch {
            return errorResponse('bad_request', language);
        }
        const fields = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
        if (isLanguage(fields.language)) language = fields.language;
        const mode = isChatMode(fields.mode) ? fields.mode : 'default';

        // 1. Rate limit.
        const rateLimit = await checkRateLimit(clientIp(req.headers));
        if (!rateLimit.success) return errorResponse('rate_limited', language, { rateLimit });

        // 2. Guardrails on the message being asked now. In the complaint
        // drafter PII does not block; it is masked below instead.
        const latest = Array.isArray(fields.messages) ? latestUserText(fields.messages) : '';
        const guard = checkGuardrails(latest, { allowPII: mode === 'grievance' });
        if (!guard.safe) {
            log.info('Guardrail blocked message', { kind: guard.kind, mode });
            return errorResponse('guardrail', language, { guardrail: guard.kind });
        }

        // 3. Validate and normalise. Earlier user turns are not re-blocked
        // (a blocked message stays in the client's history and would otherwise
        // block every later question in the thread): injection turns are
        // dropped and PII is masked in every turn before it leaves this server.
        const parsed = parseChatRequest(body, (content, isLatest) =>
            !isLatest && hasInjection(content) ? null : maskPII(content)
        );
        if (!parsed.ok) {
            log.info('Rejected chat request', { reason: parsed.reason });
            return errorResponse('bad_request', language);
        }
        const { turns, focus } = parsed.value;

        if (noProviderConfigured()) {
            log.error('No LLM provider configured: set ANTHROPIC_API_KEY, GOOGLE_GEMINI_API_KEY or GROQ_API_KEY');
            return errorResponse('provider_unavailable', language);
        }

        const signal = req.signal;
        const telemetry = new TelemetryBatch();

        const stream = createUIMessageStream<InBridgeUIMessage>({
            execute: async ({ writer }) => {
                writer.write({ type: 'start', messageMetadata: { createdAt: Date.now(), mode, language } });

                try {
                    // 4. Retrieval. The complaint drafter works from what the
                    // user tells it, so it skips the search.
                    let retrieved: RetrievedContext;
                    if (mode === 'grievance') {
                        retrieved = { docs: [], source: 'llm_direct', retrievedAt: new Date().toISOString() };
                    } else {
                        try {
                            retrieved = await ragEngine.retrieveContext(buildRetrievalQuery(turns), {
                                telemetry,
                                focus,
                                recencyText: turns[turns.length - 1].content,
                                onPhase: (phase) =>
                                    writer.write({ type: 'data-phase', data: { phase }, transient: true }),
                            });
                        } catch (error) {
                            log.error('Retrieval failed; answering without context', { error });
                            retrieved = { docs: [], source: 'llm_direct', retrievedAt: new Date().toISOString() };
                        }
                    }

                    const { citations, promptSources } = buildSources(retrieved.docs);
                    if (citations.length > 0) {
                        writer.write({
                            type: 'data-phase',
                            data: { phase: 'reading', count: citations.length },
                            transient: true,
                        });
                    }

                    // 5. Sources and provenance go out before any answer text.
                    const provenance: Provenance = {
                        source: retrieved.source,
                        retrievedAt: retrieved.retrievedAt,
                        ...(retrieved.source === 'vector_store' ? { datasetLabel: DATASET_LABEL } : {}),
                    };
                    writer.write({ type: 'data-sources', id: 'sources', data: citations satisfies Citation[] });
                    writer.write({ type: 'data-provenance', id: 'provenance', data: provenance });

                    // 6. LLM, with failover until a provider produces its first token.
                    const system = buildSystemPrompt({ language, mode, focus, sources: promptSources });
                    const routed = await routeChatStream(
                        { turns, system, signal },
                        {
                            telemetry,
                            firstTokenDeadline: firstTokenDeadline(
                                routeStartedAt,
                                maxDuration * 1000,
                                GENERATION_RESERVE_MS
                            ),
                        }
                    );

                    writer.write({ type: 'data-phase', data: { phase: 'writing' }, transient: true });

                    // 7. Answer text. The follow-up marker and everything after
                    // it are held back from the client; dashes used as
                    // punctuation are rewritten on the way out.
                    const textId = 'answer';
                    const splitter = new FollowupSplitter();
                    const dashes = new DashRewriter();
                    writer.write({ type: 'text-start', id: textId });
                    try {
                        for await (const chunk of routed.stream) {
                            const visible = dashes.push(splitter.push(chunk));
                            if (visible) writer.write({ type: 'text-delta', id: textId, delta: visible });
                        }
                        const rest = dashes.push(splitter.flush()) + dashes.flush();
                        if (rest) writer.write({ type: 'text-delta', id: textId, delta: rest });
                    } finally {
                        writer.write({ type: 'text-end', id: textId });
                    }

                    // 8. Follow-ups, parsed from the held-back tail.
                    const followups = (parseFollowups(splitter.tail) ?? fixedFollowups(language, mode)).map((q) => rewriteDashes(q));
                    if (!splitter.markerSeen) log.info('Model omitted follow-ups; using fixed set', { provider: routed.provider });
                    writer.write({ type: 'data-followups', id: 'followups', data: followups });

                    writer.write({ type: 'finish' });
                } catch (error) {
                    // Stop pressed or tab closed: nothing to report to anyone.
                    if (signal.aborted) return;
                    throw error;
                } finally {
                    await telemetry.flush();
                }
            },
            onError: (error: unknown) => {
                const code: ChatErrorCode = error instanceof ProviderUnavailableError ? 'provider_unavailable' : 'server_error';
                log.error('Chat stream error', {
                    code,
                    error,
                    cause: error instanceof ProviderUnavailableError ? error.lastError : undefined,
                });
                return JSON.stringify(chatError(code, language));
            },
        });

        return createUIMessageStreamResponse({ stream });
    } catch (error) {
        log.error('Chat API error', { error });
        return errorResponse('server_error', language);
    }
}

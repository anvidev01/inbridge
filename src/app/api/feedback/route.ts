import { feedbackLanguage, parseFeedbackBody } from '@/lib/ai/feedback';
import { checkRateLimit, clientIp } from '@/lib/ai/ratelimit';
import { chatError } from '@/lib/ai/user-copy';
import type { ChatErrorCode, Language } from '@/lib/chat/protocol';
import { log } from '@/lib/observability/logger';

export const runtime = 'nodejs';

/** A valid body is well under 1 KB; anything larger is not a feedback vote. */
const MAX_BODY_BYTES = 4 * 1024;
const FEEDBACK_PER_MIN = 30;

function errorResponse(code: ChatErrorCode, status: number, language: Language): Response {
    return new Response(JSON.stringify(chatError(code, language)), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * POST /api/feedback — thumbs up/down on an answer. Body: FeedbackBody
 * (src/lib/chat/protocol.ts). Answers 204.
 *
 * There is no database reachable from this app yet, so each vote is written
 * as one structured log line ("event":"feedback") that a log drain can
 * aggregate. The question and answer text are never received or stored.
 *
 * Error messages are localised from ?lang=en|hi|hinglish, else from
 * Accept-Language (see feedbackLanguage).
 */
export async function POST(req: Request) {
    let language: Language = 'en';
    try {
        language = feedbackLanguage(req.url, req.headers.get('accept-language'));

        // Reject by declared size before reading, so an honest oversized POST
        // is not buffered. A chunked or understated body is still read in full
        // and then rejected by the byte-length check below.
        const declaredLength = Number(req.headers.get('content-length') || 0);
        if (declaredLength > MAX_BODY_BYTES) return errorResponse('bad_request', 400, language);

        const rateLimit = await checkRateLimit(`feedback:${clientIp(req.headers)}`, FEEDBACK_PER_MIN);
        if (!rateLimit.success) return errorResponse('rate_limited', 429, language);

        const raw = await req.text();
        if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return errorResponse('bad_request', 400, language);

        let body: unknown;
        try {
            body = JSON.parse(raw);
        } catch {
            return errorResponse('bad_request', 400, language);
        }

        const parsed = parseFeedbackBody(body);
        if (!parsed.ok) {
            log.info('Rejected feedback', { reason: parsed.reason });
            return errorResponse('bad_request', 400, language);
        }

        const { messageId, rating, reasons, note, sourceType, citationHosts } = parsed.value;
        log.info('Answer feedback', {
            event: 'feedback',
            message_id: messageId,
            rating,
            reasons: reasons ?? [],
            note,
            source_type: sourceType,
            citation_hosts: citationHosts ?? [],
            ts: new Date().toISOString(),
        });

        return new Response(null, { status: 204 });
    } catch (error) {
        log.error('Feedback API error', { error });
        return errorResponse('server_error', 500, language);
    }
}

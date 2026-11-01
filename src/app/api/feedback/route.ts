import { parseFeedbackBody } from '@/lib/ai/feedback';
import { checkRateLimit, clientIp } from '@/lib/ai/ratelimit';
import { chatError } from '@/lib/ai/user-copy';
import type { ChatErrorCode } from '@/lib/chat/protocol';
import { log } from '@/lib/observability/logger';

export const runtime = 'nodejs';

/** A valid body is well under 1 KB; anything larger is not a feedback vote. */
const MAX_BODY_BYTES = 4 * 1024;
const FEEDBACK_PER_MIN = 30;

function errorResponse(code: ChatErrorCode, status: number): Response {
    return new Response(JSON.stringify(chatError(code, 'en')), {
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
 */
export async function POST(req: Request) {
    try {
        const rateLimit = await checkRateLimit(`feedback:${clientIp(req.headers)}`, FEEDBACK_PER_MIN);
        if (!rateLimit.success) return errorResponse('rate_limited', 429);

        const raw = await req.text();
        if (raw.length > MAX_BODY_BYTES) return errorResponse('bad_request', 400);

        let body: unknown;
        try {
            body = JSON.parse(raw);
        } catch {
            return errorResponse('bad_request', 400);
        }

        const parsed = parseFeedbackBody(body);
        if (!parsed.ok) {
            log.info('Rejected feedback', { reason: parsed.reason });
            return errorResponse('bad_request', 400);
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
        return errorResponse('server_error', 500);
    }
}

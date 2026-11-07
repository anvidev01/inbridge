import { checkRateLimit, clientIp } from '@/lib/ai/ratelimit';
import { noProviderConfigured, ProviderUnavailableError, routeChatStream } from '@/lib/ai/router';
import { isLanguage, type Language } from '@/lib/chat/protocol';
import { explainSystemPrompt, explainUserMessage, parseExplanation, prepareFormText } from '@/lib/forms/explain';
import { log } from '@/lib/observability/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/forms/explain  { text, language, fieldLabels? }  ->  { explanation }
 *
 * PRIVACY: `text` is the printed text of a BLANK form (read in the browser), with Aadhaar, PAN
 * and phone numbers masked again here. The person's own details are never sent: they stay in
 * the browser tab. Nothing from the request or the reply is stored, and neither the text nor
 * the labels are logged.
 */
const MAX_BODY_BYTES = 40 * 1024;
const MAX_LABELS = 60;
const MAX_LABEL_CHARS = 120;
const OVERALL_TIMEOUT_MS = 45_000;

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export function cleanLabels(input: unknown): string[] | null {
    if (input === undefined) return [];
    if (!Array.isArray(input) || input.length > MAX_LABELS) return null;
    const out = new Set<string>();
    for (const item of input) {
        if (typeof item !== 'string') return null;
        const label = item.trim();
        if (label.length > MAX_LABEL_CHARS) return null;
        if (label) out.add(label);
    }
    return [...out];
}

export async function POST(req: Request) {
    const limit = await checkRateLimit(`forms:${clientIp(req.headers)}`, 8);
    if (!limit.success) return json({ error: 'rate_limited' }, 429);
    if (Number(req.headers.get('content-length') || 0) > MAX_BODY_BYTES) return json({ error: 'bad_request' }, 400);

    let text = '';
    let language: Language = 'en';
    let labels: string[] = [];
    try {
        const raw = await req.text();
        if (raw.length > MAX_BODY_BYTES) return json({ error: 'bad_request' }, 400);
        const body = JSON.parse(raw) as { text?: unknown; language?: unknown; fieldLabels?: unknown };
        if (typeof body.text !== 'string' || body.text.trim().length < 20) return json({ error: 'bad_request' }, 400);
        if (isLanguage(body.language)) language = body.language;
        const cleaned = cleanLabels(body.fieldLabels);
        if (!cleaned) return json({ error: 'bad_request' }, 400);
        labels = cleaned;
        text = prepareFormText(body.text);
    } catch {
        return json({ error: 'bad_request' }, 400);
    }

    if (noProviderConfigured()) return json({ error: 'provider_unavailable' }, 503);

    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(OVERALL_TIMEOUT_MS)]);
    try {
        const routed = await routeChatStream(
            { turns: [{ role: 'user', content: explainUserMessage(text, labels) }], system: explainSystemPrompt(language), signal, maxTokens: 4000 },
            { firstTokenDeadline: Date.now() + 25_000 },
        );
        let reply = '';
        for await (const chunk of routed.stream) reply += chunk;
        const explanation = parseExplanation(reply);
        if (!explanation) return json({ error: 'explain_failed' }, 502);
        return json({ explanation });
    } catch (error) {
        // The form text is deliberately not logged.
        log.warn('Form explanation failed', { error, unavailable: error instanceof ProviderUnavailableError });
        return json({ error: error instanceof ProviderUnavailableError ? 'provider_unavailable' : 'explain_failed' }, error instanceof ProviderUnavailableError ? 503 : 502);
    }
}

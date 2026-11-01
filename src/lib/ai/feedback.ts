/**
 * Validation for /api/feedback bodies. Kept out of the route file so it can be
 * unit-tested without Next.js.
 *
 * Strict on purpose: unknown fields are rejected rather than ignored, so a
 * client can never start shipping the question text "by accident" in an
 * extra field that then lands in the logs.
 */

import {
    FEEDBACK_NOTE_MAX,
    FEEDBACK_REASONS,
    isLanguage,
    type FeedbackBody,
    type FeedbackReason,
    type Language,
    type RetrievalSource,
} from '../chat/protocol';
import { maskPII } from '../guardrails';

const ALLOWED_KEYS = new Set(['messageId', 'rating', 'reasons', 'note', 'sourceType', 'citationHosts']);
const SOURCE_TYPES: RetrievalSource[] = ['vector_store', 'tavily_search', 'llm_direct', 'cache'];
const MESSAGE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const HOSTNAME = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const MAX_HOSTS = 20;

export type FeedbackParseResult = { ok: true; value: FeedbackBody } | { ok: false; reason: string };

export function parseFeedbackBody(raw: unknown): FeedbackParseResult {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, reason: 'body must be an object' };
    }
    const body = raw as Record<string, unknown>;

    for (const key of Object.keys(body)) {
        if (!ALLOWED_KEYS.has(key)) return { ok: false, reason: `unknown field ${key}` };
    }

    if (typeof body.messageId !== 'string' || !MESSAGE_ID.test(body.messageId)) {
        return { ok: false, reason: 'invalid messageId' };
    }
    if (body.rating !== 'up' && body.rating !== 'down') {
        return { ok: false, reason: 'invalid rating' };
    }
    const value: FeedbackBody = { messageId: body.messageId, rating: body.rating };

    if (body.reasons !== undefined) {
        if (!Array.isArray(body.reasons) || body.reasons.length > FEEDBACK_REASONS.length) {
            return { ok: false, reason: 'invalid reasons' };
        }
        const reasons = new Set<FeedbackReason>();
        for (const r of body.reasons) {
            if (!(FEEDBACK_REASONS as readonly unknown[]).includes(r)) {
                return { ok: false, reason: 'invalid reasons' };
            }
            reasons.add(r as FeedbackReason);
        }
        value.reasons = [...reasons];
    }

    if (body.note !== undefined) {
        if (typeof body.note !== 'string' || body.note.length > FEEDBACK_NOTE_MAX) {
            return { ok: false, reason: 'invalid note' };
        }
        const note = maskPII(body.note.trim());
        if (note) value.note = note;
    }

    if (body.sourceType !== undefined) {
        if (!SOURCE_TYPES.includes(body.sourceType as RetrievalSource)) {
            return { ok: false, reason: 'invalid sourceType' };
        }
        value.sourceType = body.sourceType as RetrievalSource;
    }

    if (body.citationHosts !== undefined) {
        if (!Array.isArray(body.citationHosts) || body.citationHosts.length > MAX_HOSTS) {
            return { ok: false, reason: 'invalid citationHosts' };
        }
        const hosts = new Set<string>();
        for (const h of body.citationHosts) {
            if (typeof h !== 'string' || !HOSTNAME.test(h)) {
                return { ok: false, reason: 'invalid citationHosts' };
            }
            hosts.add(h);
        }
        value.citationHosts = [...hosts];
    }

    return { ok: true, value };
}

/**
 * Language for /api/feedback error messages. The body is strict (no extra
 * fields), so the client signals it with ?lang=en|hi|hinglish, validated with
 * isLanguage. Without it, the highest-weighted Accept-Language tag the UI
 * supports is used ("hi-Latn" reads as Hinglish). Defaults to English.
 */
export function feedbackLanguage(url: string, acceptLanguage: string | null): Language {
    let fromQuery: string | null = null;
    try {
        fromQuery = new URL(url).searchParams.get('lang');
    } catch {
        // Relative or malformed URL: no query hint.
    }
    if (isLanguage(fromQuery)) return fromQuery;

    if (acceptLanguage) {
        const tags = acceptLanguage
            .split(',')
            .map((part) => {
                const [tag, ...params] = part.trim().toLowerCase().split(';');
                const q = params.map((p) => /^\s*q=([\d.]+)\s*$/.exec(p)?.[1]).find(Boolean);
                return { tag: tag.trim(), q: q === undefined ? 1 : Number(q) };
            })
            .filter((t) => t.tag && t.q > 0)
            .sort((a, b) => b.q - a.q);
        for (const { tag } of tags) {
            if (tag === 'hinglish' || tag.startsWith('hi-latn')) return 'hinglish';
            if (tag === 'hi' || tag.startsWith('hi-')) return 'hi';
            if (tag === 'en' || tag.startsWith('en-')) return 'en';
        }
    }
    return 'en';
}

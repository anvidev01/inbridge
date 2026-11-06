/**
 * Turns an untrusted /api/chat body into what the pipeline needs.
 *
 * The client controls everything in the body, so nothing here is taken at
 * face value: roles are whitelisted, only text parts are read, history is
 * capped, and language/mode/focus are enums with defaults. The free-text
 * `languageInstruction` the old client sent is ignored entirely; it was a
 * prompt-injection channel straight into the system prompt.
 */

import { isChatMode, isFocus, isLanguage, type ChatMode, type Focus, type Language } from '../chat/protocol';

export interface ChatTurn {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatRequest {
    language: Language;
    mode: ChatMode;
    focus: Focus;
    /** Normalised history, oldest first, always ending with a user turn. */
    turns: ChatTurn[];
}

export type ChatRequestResult = { ok: true; value: ChatRequest } | { ok: false; reason: string };

/** Messages (not exchanges) kept from the history. */
export const MAX_HISTORY_TURNS = 10;
/** Per-message cap; longer pasted text is cut, not rejected. */
export const MAX_TURN_CHARS = 4000;
/** Upper bound on messages[] before any trimming, to reject junk early. */
const MAX_INCOMING_MESSAGES = 200;

// Older clients put the sources JSON inside the answer text. Threads saved in
// localStorage before the data-part change may still contain it.
const LEGACY_SOURCES_BLOCK = /---SOURCES---[\s\S]*?---END_SOURCES---\s*/g;
const FOLLOWUPS_TAIL = /---FOLLOWUPS---[\s\S]*$/;

function textOf(message: unknown): string {
    if (!message || typeof message !== 'object') return '';
    const parts = (message as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) return '';
    return parts
        .filter(
            (p): p is { type: 'text'; text: string } =>
                !!p && typeof p === 'object' && p.type === 'text' && typeof p.text === 'string'
        )
        .map((p) => p.text)
        .join('');
}

/**
 * Called for each user turn before merging. Return null to drop the turn.
 * `isLatest` is true for the message being asked now.
 */
export type UserTurnFilter = (content: string, isLatest: boolean) => string | null;

/**
 * Whitelists user/assistant roles, keeps text parts only, strips legacy
 * blocks, merges consecutive same-role turns (Gemini rejects them), and keeps
 * the last MAX_HISTORY_TURNS messages starting from a user turn.
 */
export function normaliseHistory(messages: unknown[], filterUser?: UserTurnFilter): ChatTurn[] {
    const raw: ChatTurn[] = [];
    for (const message of messages) {
        if (!message || typeof message !== 'object') continue;
        const role = (message as { role?: unknown }).role;
        if (role !== 'user' && role !== 'assistant') continue;

        let content = textOf(message);
        if (role === 'assistant') {
            content = content.replace(LEGACY_SOURCES_BLOCK, '').replace(FOLLOWUPS_TAIL, '');
        }
        content = content.trim().slice(0, MAX_TURN_CHARS);
        if (content) raw.push({ role, content });
    }

    const latestUser = raw.map((t) => t.role).lastIndexOf('user');
    const turns: ChatTurn[] = [];
    raw.forEach((turn, i) => {
        let content: string | null = turn.content;
        if (turn.role === 'user' && filterUser) content = filterUser(content, i === latestUser);
        if (!content) return;

        const last = turns[turns.length - 1];
        if (last && last.role === turn.role) {
            last.content = `${last.content}\n\n${content}`.slice(-MAX_TURN_CHARS);
        } else {
            turns.push({ role: turn.role, content });
        }
    });

    let recent = turns.slice(-MAX_HISTORY_TURNS);
    while (recent.length > 0 && recent[0].role !== 'user') recent = recent.slice(1);
    return recent;
}

/** Text of the last user message, before any filtering or merging. */
export function latestUserText(messages: unknown[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m && typeof m === 'object' && (m as { role?: unknown }).role === 'user') {
            return textOf(m).trim().slice(0, MAX_TURN_CHARS);
        }
    }
    return '';
}

/**
 * Validates the body. Guardrails run on the latest user message *before*
 * this (see the route); `filterUser` then masks or drops content in turns.
 */
export function parseChatRequest(raw: unknown, filterUser?: UserTurnFilter): ChatRequestResult {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, reason: 'body must be an object' };
    }
    const body = raw as Record<string, unknown>;
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return { ok: false, reason: 'messages must be a non-empty array' };
    }
    if (body.messages.length > MAX_INCOMING_MESSAGES) {
        return { ok: false, reason: 'too many messages' };
    }

    const turns = normaliseHistory(body.messages, filterUser);
    if (turns.length === 0 || turns[turns.length - 1].role !== 'user') {
        return { ok: false, reason: 'last message must be a user message with text' };
    }

    return {
        ok: true,
        value: {
            language: isLanguage(body.language) ? body.language : 'en',
            mode: isChatMode(body.mode) ? body.mode : 'default',
            focus: isFocus(body.focus) ? body.focus : 'all',
            turns,
        },
    };
}

/** Max characters of the retrieval query. The embedder truncates long input anyway. */
const MAX_QUERY_CHARS = 600;

/** Words that carry no subject: a question made only of these (and the generic words below) needs context. */
export const FILLER_WORDS = new Set([
    'a', 'an', 'the', 'to', 'of', 'for', 'in', 'on', 'at', 'by', 'with', 'from', 'and', 'or', 'but', 'is', 'are', 'was', 'be', 'do', 'does', 'did', 'i', 'me', 'my',
    'we', 'you', 'what', 'which', 'where', 'when', 'how', 'who', 'whom', 'why', 'can', 'could', 'should', 'will', 'would', 'please', 'about', 'tell', 'give', 'know',
    'also', 'any', 'there', 'then', 'now', 'much', 'many', 'long', 'get', 'got', 'have', 'has', 'need', 'needs', 'needed', 'required', 'require', 'want',
    // Hinglish
    'ke', 'ka', 'ki', 'ko', 'se', 'mein', 'me', 'par', 'aur', 'ya', 'bhi', 'hai', 'hain', 'ho', 'kya', 'kaise', 'kab', 'kahan', 'kaun', 'kitna', 'kitni',
    'liye', 'chahiye', 'lagenge', 'lagega', 'lagegi', 'lagta', 'lagti', 'karein', 'kare', 'karna', 'kar', 'milega', 'milegi', 'batao', 'bataiye', 'mujhe', 'mera', 'meri',
]);

/** Everyday question topics that do not name a scheme: "documents?", "eligibility?", "last date?". */
export const GENERIC_TOPICS = new Set([
    'apply', 'application', 'applying', 'process', 'procedure', 'steps', 'step', 'documents', 'document', 'eligibility', 'eligible', 'benefits', 'benefit', 'amount',
    'status', 'date', 'dates', 'deadline', 'fee', 'fees', 'cost', 'details', 'detail', 'online', 'offline', 'form', 'forms', 'link', 'portal', 'website', 'helpline',
    'number', 'registration', 'register', 'renew', 'renewal', 'update', 'check', 'claim', 'payment', 'installment', 'time', 'last', 'first', 'next', 'more', 'else',
    // Hinglish
    'aavedan', 'avedan', 'apply', 'dastavez', 'dastawez', 'kagaz', 'patrata', 'labh', 'tareekh', 'tarikh', 'jankari', 'jaankari', 'paisa', 'paise',
]);

/** Words that point back at the previous message: "it", "this scheme", "iske liye". */
const BACK_REFERENCES = new Set([
    'it', 'its', 'this', 'that', 'these', 'those', 'same', 'above', 'previous', 'earlier', 'them', 'their',
    'iske', 'uske', 'isme', 'usme', 'isko', 'usko', 'iska', 'uska', 'isse', 'usse', 'yeh', 'yah', 'woh', 'wo', 'ye',
]);

/** A back-reference only marks a follow-up in a short question; long ones name their own subject. */
const MAX_FOLLOW_UP_WORDS = 8;

/**
 * True when a question has no subject of its own and only makes sense after the
 * previous one ("what documents do I need?", "where to apply?", "iske liye kya
 * chahiye"). A question that names a scheme or service ("PAN card", "PM-KISAN
 * eligibility") is self-contained, however short.
 */
export function isFollowUpQuestion(text: string): boolean {
    const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    if (words.length === 0) return false;
    if (words.length <= MAX_FOLLOW_UP_WORDS && words.some((w) => BACK_REFERENCES.has(w))) return true;
    const content = words.filter((w) => !FILLER_WORDS.has(w));
    return content.every((w) => GENERIC_TOPICS.has(w));
}

/**
 * The text the scheme search runs on.
 *
 * A question that stands on its own is searched ALONE. Mixing in earlier turns
 * hurts it: asking the same question twice doubled the text and PM-KISAN dropped
 * out of the results, and a new topic after an unrelated one blended both.
 *
 * A genuine follow-up ("what documents do I need for it?") embeds to nothing
 * useful alone, so the previous distinct user turns (up to maxUserTurns in all,
 * newest last) go in front of it. When the combined text is too long the oldest
 * turns are dropped first.
 */
export function buildRetrievalQuery(turns: ChatTurn[], maxUserTurns = 3): string {
    const users = turns.filter((t) => t.role === 'user').map((t) => t.content.replace(/\s+/g, ' ').trim());
    const latest = users[users.length - 1];
    if (latest === undefined) return '';
    if (!isFollowUpQuestion(latest)) return latest.slice(-MAX_QUERY_CHARS);

    const kept: string[] = [latest];
    let length = latest.length;
    for (let i = users.length - 2; i >= 0 && kept.length < maxUserTurns; i--) {
        const text = users[i];
        if (!text || kept.includes(text)) continue;
        if (length + text.length + 1 > MAX_QUERY_CHARS) break;
        kept.unshift(text);
        length += text.length + 1;
    }
    return kept.join('\n').slice(-MAX_QUERY_CHARS);
}

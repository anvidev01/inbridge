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

/**
 * Retrieval query from the last 3 user turns, newest last.
 *
 * A follow-up like "what documents do I need for it?" embeds to nothing
 * useful on its own; with the previous turn ("PM-KISAN eligibility") in front
 * of it the vector store finds the right scheme. When the combined text is too
 * long, the oldest turns are dropped first.
 */
export function buildRetrievalQuery(turns: ChatTurn[], maxUserTurns = 3): string {
    const userTexts = turns.filter((t) => t.role === 'user').slice(-maxUserTurns);
    const kept: string[] = [];
    let length = 0;
    for (let i = userTexts.length - 1; i >= 0; i--) {
        const text = userTexts[i].content.replace(/\s+/g, ' ').trim();
        if (kept.length > 0 && length + text.length + 1 > MAX_QUERY_CHARS) break;
        kept.unshift(text);
        length += text.length + 1;
    }
    return kept.join('\n').slice(-MAX_QUERY_CHARS);
}

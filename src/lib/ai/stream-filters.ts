/**
 * Incremental filters applied to the model's text as it streams.
 *
 * They share one problem: a token they care about ("<think>",
 * "---FOLLOWUPS---", a dash and the space after it) can arrive split across
 * chunks ("---FOLL" + "OWUPS---"). Each filter therefore holds back any tail of
 * the buffer that could still turn into the token, and releases it once the
 * next chunk proves what it was.
 */

import type { ChatMode, Language } from '../chat/protocol';

/** Length of the longest suffix of `text` that is a proper prefix of `token`. */
export function partialTokenSuffix(text: string, token: string): number {
    const max = Math.min(text.length, token.length - 1);
    for (let len = max; len > 0; len--) {
        if (token.startsWith(text.slice(text.length - len))) return len;
    }
    return 0;
}

/**
 * Removes <think>...</think> blocks that reasoning models (Qwen3, DeepSeek-R1
 * on Groq) emit inline before the answer. Without this the user sees the
 * model's private scratchpad streamed as the answer.
 */
export class ThinkStripper {
    private static OPEN = '<think>';
    private static CLOSE = '</think>';

    private pending = '';
    private inside = false;

    push(chunk: string): string {
        let buffer = this.pending + chunk;
        this.pending = '';
        let out = '';

        while (buffer) {
            const token = this.inside ? ThinkStripper.CLOSE : ThinkStripper.OPEN;
            const idx = buffer.indexOf(token);
            if (idx >= 0) {
                if (!this.inside) out += buffer.slice(0, idx);
                buffer = buffer.slice(idx + token.length);
                this.inside = !this.inside;
                continue;
            }
            const hold = partialTokenSuffix(buffer, token);
            if (!this.inside) out += buffer.slice(0, buffer.length - hold);
            this.pending = buffer.slice(buffer.length - hold);
            break;
        }
        return out;
    }

    /** Text still held back at end of stream. An unclosed <think> is dropped. */
    flush(): string {
        const rest = this.inside ? '' : this.pending;
        this.pending = '';
        return rest;
    }
}

/** The line the model is told to put between its answer and the follow-up JSON. */
export const FOLLOWUPS_MARKER = '---FOLLOWUPS---';

/**
 * Splits the model output at FOLLOWUPS_MARKER. Text before the marker is
 * forwarded to the client; the marker and everything after it never are.
 */
export class FollowupSplitter {
    private pending = '';
    private found = false;
    private tailText = '';

    constructor(private marker: string = FOLLOWUPS_MARKER) {}

    /** Returns the part of `chunk` that is safe to show the user now. */
    push(chunk: string): string {
        if (this.found) {
            this.tailText += chunk;
            return '';
        }
        const buffer = this.pending + chunk;
        this.pending = '';

        const idx = buffer.indexOf(this.marker);
        if (idx >= 0) {
            this.found = true;
            this.tailText = buffer.slice(idx + this.marker.length);
            return buffer.slice(0, idx);
        }
        const hold = partialTokenSuffix(buffer, this.marker);
        this.pending = buffer.slice(buffer.length - hold);
        return buffer.slice(0, buffer.length - hold);
    }

    /** Releases held-back text at end of stream (it was never the marker). */
    flush(): string {
        const rest = this.pending;
        this.pending = '';
        return rest;
    }

    get markerSeen(): boolean {
        return this.found;
    }

    /** Raw text after the marker, for parseFollowups. */
    get tail(): string {
        return this.tailText;
    }
}

/**
 * Em dashes (U+2014) and en dashes (U+2013) used as punctuation read as
 * machine-written in Indian English and Hindi alike, and the prompt alone does
 * not stop every model from using them. Each run of dashes (written EM below)
 * is rewritten from what is around it:
 *   "word EM word"   -> "word, word"
 *   "a list EM" at the end of a line -> "a list:"
 *   "EM item" at the start of a line -> "- item" (a markdown bullet)
 *   "2024 EN 25" with no spaces -> "2024-25" (a range keeps a hyphen)
 *   "| EM |" in a table -> "| - |"
 *   next to other punctuation ("word, EM next", "word EM.") the dash is dropped.
 * Hyphens are never touched, so "PM-KISAN", "2024-25" and the follow-ups
 * marker pass through as they are.
 */
const DASH_RUN = /([ \t]*)[\u2013\u2014](?:[ \t]*[\u2013\u2014])*([ \t]*)/g;
/** A tail that may still be part of a rewrite: any trailing spaces and dashes. */
const DASH_TAIL = /[ \t\u2013\u2014]*$/;
const PUNCT_BEFORE = /[,;:.!?\u0964]/;
const PUNCT_AFTER = /[,;:.!?)\]\u0964]/;

/**
 * Rewrites every dash run in `text`. `prev` is the character just before
 * `text` ('\n' at the start of a reply). A dash run at the very end of `text`
 * is treated as the end of the reply, so stream callers must hold back DASH_TAIL.
 */
export function rewriteDashes(text: string, prev = '\n'): string {
    return text.replace(DASH_RUN, (match: string, lead: string, trail: string, offset: number) => {
        const before = offset > 0 ? text[offset - 1] : prev;
        const afterIdx = offset + match.length;
        const after = afterIdx < text.length ? text[afterIdx] : '';
        const lineStart = before === '\n' || before === '';
        const lineEnd = after === '\n' || after === '\r' || after === '';

        // A range between figures keeps a hyphen (2024 EN 25 becomes 2024-25).
        if (!lead && !trail && /\d/.test(before) && /\d/.test(after)) return '-';
        // "EM item" at the start of a line was meant as a bullet.
        if (lineStart) return lineEnd ? lead : `${lead}- `;
        // An empty table cell or a dash next to a pipe.
        if (before === '|' || after === '|') return `${lead}-${trail}`;
        if (PUNCT_BEFORE.test(before)) return lineEnd ? '' : ' ';
        if (before === '(' || PUNCT_AFTER.test(after)) return '';
        // A dash closing a line introduces what follows (usually a list).
        if (lineEnd) return ':';
        return ', ';
    });
}

/**
 * Streaming wrapper around rewriteDashes. A dash can arrive split from the
 * words around it ("word EM" + " next", "word " + "EM next"), so any trailing
 * spaces or dash are held back until the next chunk shows what follows them.
 */
export class DashRewriter {
    private pending = '';
    private prev = '\n';

    push(chunk: string): string {
        const buffer = this.pending + chunk;
        const hold = buffer.length - (DASH_TAIL.exec(buffer)?.index ?? buffer.length);
        const ready = buffer.slice(0, buffer.length - hold);
        this.pending = buffer.slice(buffer.length - hold);
        return this.emit(ready);
    }

    /** Releases held-back text at end of stream. */
    flush(): string {
        const rest = this.pending;
        this.pending = '';
        return this.emit(rest);
    }

    private emit(text: string): string {
        if (!text) return '';
        const out = rewriteDashes(text, this.prev);
        this.prev = text[text.length - 1];
        return out;
    }
}

const MAX_FOLLOWUPS = 3;
const MAX_FOLLOWUP_CHARS = 120;

/**
 * Parses the JSON array after the marker. Returns null when nothing usable is
 * there, so the caller can fall back to fixedFollowups().
 */
export function parseFollowups(tail: string): string[] | null {
    const start = tail.indexOf('[');
    const end = tail.lastIndexOf(']');
    if (start < 0 || end <= start) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(tail.slice(start, end + 1));
    } catch {
        return null;
    }
    if (!Array.isArray(parsed)) return null;

    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of parsed) {
        if (typeof item !== 'string') continue;
        const text = item.replace(/\s+/g, ' ').trim();
        if (!text || text.length > MAX_FOLLOWUP_CHARS) continue;
        // Follow-ups are sent back verbatim as the next question; a URL or
        // markdown in one is a sign the model ignored the format.
        if (/https?:\/\/|[[\]<>*`]/.test(text)) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
        if (out.length === MAX_FOLLOWUPS) break;
    }
    return out.length > 0 ? out : null;
}

const FALLBACK_FOLLOWUPS: Record<ChatMode, Record<Language, string[]>> = {
    default: {
        en: [
            'How do I apply for this?',
            'What documents do I need?',
            'Where can I check my application status on the official portal?',
        ],
        hi: [
            'इसके लिए आवेदन कैसे करें?',
            'कौन-से दस्तावेज़ चाहिए?',
            'आधिकारिक पोर्टल पर आवेदन की स्थिति कहाँ देखें?',
        ],
        hinglish: [
            'Iske liye apply kaise karein?',
            'Kaun se documents chahiye?',
            'Official portal par application status kahan check karein?',
        ],
    },
    grievance: {
        en: [
            'How do I submit this on CPGRAMS?',
            'How can I track my complaint?',
            'Can you make the draft shorter?',
        ],
        hi: [
            'इसे CPGRAMS पर कैसे जमा करें?',
            'अपनी शिकायत की स्थिति कैसे देखें?',
            'क्या आप ड्राफ़्ट को छोटा कर सकते हैं?',
        ],
        hinglish: [
            'Ise CPGRAMS par kaise submit karein?',
            'Apni complaint ka status kaise track karein?',
            'Kya aap draft ko chhota kar sakte hain?',
        ],
    },
};

/** Fixed follow-ups used when the model's own list is missing or malformed. */
export function fixedFollowups(language: Language, mode: ChatMode = 'default'): string[] {
    return [...FALLBACK_FOLLOWUPS[mode][language]];
}

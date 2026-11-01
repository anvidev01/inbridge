/**
 * Incremental filters applied to the model's text as it streams.
 *
 * Both filters have the same problem to solve: a token they care about
 * ("<think>", "---FOLLOWUPS---") can arrive split across chunks ("---FOLL" +
 * "OWUPS---"). Each filter therefore holds back any tail of the buffer that
 * could still turn into the token, and releases it once the next chunk proves
 * it was ordinary text.
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

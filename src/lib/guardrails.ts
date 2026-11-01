/**
 * Server-side checks on user text before it reaches retrieval or an LLM.
 *
 * Two jobs:
 *  - PII: Aadhaar, PAN and Indian mobile numbers. Blocked in normal chat,
 *    masked in the complaint drafter (where a reference number is expected).
 *  - Prompt injection: phrase-level patterns only.
 *
 * The previous version matched single words ("bypass", "forget all") and any
 * 12 digits, so "heart bypass surgery scheme" and "schemes for 2024 2025 2026"
 * were rejected. Every pattern here must keep those real queries passing; see
 * src/lib/__tests__/guardrails.test.ts.
 */

export type GuardrailKind = 'pii_aadhaar' | 'pii_pan' | 'pii_phone' | 'injection';

export interface GuardrailResult {
    safe: boolean;
    kind?: GuardrailKind;
    /** English, for logs only. The route sends a localised message to users. */
    error?: string;
}

// ── Aadhaar ───────────────────────────────────────────────────────────────

// Verhoeff tables. UIDAI issues Aadhaar numbers whose last digit is a Verhoeff
// check digit, so a random 12-digit run passes only 1 time in 10.
const VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** True when the digit string (check digit last) passes the Verhoeff check. */
export function verhoeffValid(digits: string): boolean {
    if (!/^\d+$/.test(digits)) return false;
    let c = 0;
    const reversed = digits.split('').reverse();
    for (let i = 0; i < reversed.length; i++) {
        c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(reversed[i])]];
    }
    return c === 0;
}

// Aadhaar never starts with 0 or 1. Groups may be separated by a space or hyphen.
const AADHAAR_PATTERN = /\b([2-9]\d{3})[\s-]?(\d{4})[\s-]?(\d{4})\b/g;

/** "2024 2025 2026": three separated groups that all read as years. */
function looksLikeYearRun(match: string, groups: string[]): boolean {
    return /[\s-]/.test(match) && groups.every((g) => /^(19|20)\d\d$/.test(g));
}

function findAadhaar(text: string): RegExpMatchArray[] {
    return [...text.matchAll(AADHAAR_PATTERN)].filter((m) => {
        const groups = [m[1], m[2], m[3]];
        return verhoeffValid(groups.join('')) && !looksLikeYearRun(m[0], groups);
    });
}

// ── PAN ───────────────────────────────────────────────────────────────────

// 5 letters, 4 digits, 1 letter; the 4th letter encodes the holder type
// (P person, C company, H HUF, F firm, A AOP, T trust, B BOI, L local
// authority, J juridical person, G government).
const PAN_PATTERN = /\b[A-Z]{3}[ABCFGHJLPT][A-Z]\d{4}[A-Z]\b/gi;

// ── Phone ─────────────────────────────────────────────────────────────────

// Indian mobile: 10 digits starting 6-9. Either prefixed by +91, 91 or 0 (and
// then optionally written 5+5 with a space or hyphen), or a bare unbroken run
// of 10 digits. A bare 5+5 split is NOT treated as a phone number: income and
// amount ranges such as "60000-90000" or "75000 80000" look exactly like it.
// The leading group stops a match starting inside a longer digit run (no
// lookbehind: the TS target is ES2017).
const PHONE_PATTERN = /(^|[^\d+])((?:\+?91[\s-]?|0)[6-9]\d{4}[\s-]?\d{5}|[6-9]\d{9})(?!\d)/g;

// ── Injection ─────────────────────────────────────────────────────────────

const INJECTION_PATTERNS: RegExp[] = [
    // "ignore previous instructions", "disregard all prior rules", "forget the above prompt"
    /\b(ignore|disregard|forget|override|skip)\s+(all\s+|any\s+|of\s+)?(the\s+|your\s+|these\s+|those\s+)?(previous|prior|above|earlier|preceding|original|initial|system)\s+(instructions?|prompts?|rules|directions|guidelines|messages?)\b/i,
    // "ignore all instructions", "forget everything you were told"
    /\b(ignore|disregard|forget)\s+(all|any|your)\s+(instructions?|rules|guidelines)\b/i,
    /\b(ignore|disregard|forget)\s+everything\s+(you\s+(were|have\s+been)\s+told|above|before)\b/i,
    // "reveal your system prompt", "print the hidden instructions"
    /\b(reveal|show|print|repeat|display|output|leak|dump|tell\s+me)\s+(me\s+)?(your|the)\s+(system|hidden|initial|original|secret)\s+(prompt|instructions?|message|rules)\b/i,
    // "give me the system prompt", "what is your system prompt". A bare
    // "what is a system prompt" is a harmless question and passes.
    /\b(reveal|show|print|repeat|give|send|share|display|output|leak|dump|copy|paste|tell\s+me)\b.{0,20}\bsystem\s+prompt\b/i,
    /\byour\s+(system|hidden|initial|original|secret)\s+(prompt|instructions)\b/i,
    // "bypass your safety rules", but not "heart bypass surgery" or "bypass road"
    /\bbypass\s+(your|the|all|any)\s+(safety|guardrails?|filters?|restrictions?|rules|instructions?|content\s+polic(y|ies))\b/i,
    /\bjail\s?break(s|ing|ed)?\b/i,
    /\b(developer|dan|god)\s+mode\b/i,
    /\bdo\s+anything\s+now\b/i,
    /\b(act|behave|respond)\s+as\s+(if\s+you\s+(are|were)\s+)?(an?\s+)?(unrestricted|unfiltered|uncensored)\b/i,
    // Chat-template and role spoofing.
    /<\|?\s*(im_start|im_end|system|endoftext)\s*\|?>/i,
    /^\s*\[?\s*(system|assistant)\s*\]?\s*:/im,
];

function stripTags(text: string): string {
    return text.replace(/<[^>]*>?/gm, '');
}

/** True when the text contains a prompt-injection phrase. */
export function hasInjection(text: string): boolean {
    // Run on the raw text too: stripTags would erase "<|im_start|>" before we see it.
    return INJECTION_PATTERNS.some((p) => p.test(text) || p.test(stripTags(text)));
}

/** First kind of PII found in the text, or null. */
export function detectPII(text: string): Exclude<GuardrailKind, 'injection'> | null {
    if (findAadhaar(text).length > 0) return 'pii_aadhaar';
    PAN_PATTERN.lastIndex = 0;
    if (PAN_PATTERN.test(text)) return 'pii_pan';
    PHONE_PATTERN.lastIndex = 0;
    if (PHONE_PATTERN.test(text)) return 'pii_phone';
    return null;
}

/**
 * Masks Aadhaar, PAN and phone numbers, keeping the last 4 characters so the
 * user can still recognise which number they meant. Used by the complaint
 * drafter and for earlier history turns.
 */
export function maskPII(text: string): string {
    let out = text;
    for (const m of findAadhaar(out)) {
        out = out.replace(m[0], `XXXX-XXXX-${m[3]}`);
    }
    out = out.replace(PAN_PATTERN, (pan) => `XXXXX${pan.slice(5, 9)}X`);
    out = out.replace(PHONE_PATTERN, (_all, lead: string, phone: string) => {
        const digits = phone.replace(/\D/g, '');
        return `${lead}XXXXXX${digits.slice(-4)}`;
    });
    return out;
}

/**
 * Checks one user message.
 *
 * `allowPII` is for the complaint drafter: PII does not block there, it is
 * masked by the caller with maskPII before the text goes anywhere.
 */
export function checkGuardrails(text: string, options: { allowPII?: boolean } = {}): GuardrailResult {
    if (hasInjection(text)) {
        return { safe: false, kind: 'injection', error: 'Potentially unsafe instructions detected.' };
    }
    if (!options.allowPII) {
        const pii = detectPII(stripTags(text));
        if (pii) {
            return { safe: false, kind: pii, error: `Query contains ${pii.replace('pii_', '')} number.` };
        }
    }
    return { safe: true };
}

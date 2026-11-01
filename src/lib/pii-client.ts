/**
 * Client-side PII pre-check (F12).
 *
 * While the user types, spot things that look like an Aadhaar number, a PAN or
 * an Indian mobile number so the composer can warn and offer "Mask it". This is
 * a courtesy only: the server guardrail still blocks PII independently.
 *
 * Patterns are deliberately narrow to avoid nagging on ordinary queries:
 *  - Aadhaar: 12 digits, first digit 2-9, optional 4-4-4 separators, and the
 *    Verhoeff check digit must be valid (UIDAI numbers always pass it), so year
 *    runs like "2024 2025 2026" are not flagged.
 *  - PAN: AAAAA9999A where the 4th letter is a valid holder-type code.
 *  - Phone: 10 digits starting 6-9, optional +91 / 91 / 0 prefix, not part of a longer digit run.
 */

export type PiiKind = 'aadhaar' | 'pan' | 'phone';

export interface PiiMatch {
    kind: PiiKind;
    /** Index of the first character in the input. */
    start: number;
    /** Index after the last character. */
    end: number;
    value: string;
}

// ── Verhoeff ──────────────────────────────────────────────────────────────

const D = [
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
const P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 7, 8, 6, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/** True when the digit string (check digit last) passes the Verhoeff checksum. */
export function isValidVerhoeff(digits: string): boolean {
    if (!/^\d+$/.test(digits)) return false;
    let c = 0;
    const rev = digits.split('').reverse();
    for (let i = 0; i < rev.length; i++) c = D[c][P[i % 8][Number(rev[i])]];
    return c === 0;
}

/** The Verhoeff check digit to append to `digits`. */
export function verhoeffCheckDigit(digits: string): number {
    let c = 0;
    const rev = digits.split('').reverse();
    for (let i = 0; i < rev.length; i++) c = D[c][P[(i + 1) % 8][Number(rev[i])]];
    return INV[c];
}

// ── Detection ─────────────────────────────────────────────────────────────

const AADHAAR_RE = /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g;
const PAN_RE = /\b[A-Z]{3}[ABCFGHJLPT][A-Z]\d{4}[A-Z]\b/gi;
// No lookbehind (older Safari); the "not preceded by a digit" rule is checked in code.
const PHONE_RE = /(?:\+?91[ -]?|0)?[6-9]\d{4}[ -]?\d{5}(?!\d)/g;

function collect(re: RegExp, text: string, kind: PiiKind, accept: (value: string, start: number) => boolean): PiiMatch[] {
    const out: PiiMatch[] = [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        if (accept(m[0], m.index)) out.push({ kind, start: m.index, end: m.index + m[0].length, value: m[0] });
        else re.lastIndex = m.index + 1; // allow a shorter match starting one character later
    }
    return out;
}

/** All PII-looking spans, in order, without overlaps (Aadhaar wins over phone). */
export function findPii(text: string): PiiMatch[] {
    if (!text) return [];
    const aadhaar = collect(AADHAAR_RE, text, 'aadhaar', (v) => isValidVerhoeff(v.replace(/\D/g, '')));
    const pan = collect(PAN_RE, text, 'pan', () => true);
    const phone = collect(PHONE_RE, text, 'phone', (_v, start) => start === 0 || !/[\d+]/.test(text[start - 1]));

    const ordered = [...aadhaar, ...pan, ...phone]; // priority order for overlaps
    const kept: PiiMatch[] = [];
    for (const m of ordered) {
        if (!kept.some((k) => m.start < k.end && k.start < m.end)) kept.push(m);
    }
    return kept.sort((a, b) => a.start - b.start);
}

/** Masked replacement for one match; keeps only the last 4 characters. */
export function maskValue(match: Pick<PiiMatch, 'kind' | 'value'>): string {
    if (match.kind === 'pan') return `XXXXXX${match.value.slice(-4).toUpperCase()}`;
    const digits = match.value.replace(/\D/g, '');
    if (match.kind === 'aadhaar') return `XXXX-XXXX-${digits.slice(-4)}`;
    return `XXXXXX${digits.slice(-4)}`;
}

/** Replace every detected Aadhaar / PAN / phone number with its masked form. */
export function maskPii(text: string): string {
    const matches = findPii(text);
    if (matches.length === 0) return text;
    let out = '';
    let cursor = 0;
    for (const m of matches) {
        out += text.slice(cursor, m.start) + maskValue(m);
        cursor = m.end;
    }
    return out + text.slice(cursor);
}

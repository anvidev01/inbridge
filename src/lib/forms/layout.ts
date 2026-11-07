/**
 * Where on a page does a form field's label sit, and where should the answer be written?
 *
 * Pure geometry and text matching over text lines read from the page (by the PDF's own
 * text layer or by OCR in the browser). Runs in the browser; nothing here does I/O.
 * Coordinates are page pixels, origin top-left.
 */

export interface Word {
    text: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Line {
    text: string;
    x: number;
    y: number;
    w: number;
    h: number;
    words: Word[];
    page: number;
}

/** Lower-case letters, digits and Devanagari marks only. */
export function normalize(text: string): string {
    return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function bigrams(s: string): Map<string, number> {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
        const g = s.slice(i, i + 2);
        out.set(g, (out.get(g) ?? 0) + 1);
    }
    return out;
}

/** Sørensen-Dice similarity of two strings, ignoring spaces. 1 = same, 0 = nothing shared. */
export function dice(a: string, b: string): number {
    const x = normalize(a).replace(/ /g, '');
    const y = normalize(b).replace(/ /g, '');
    if (!x || !y) return 0;
    if (x === y) return 1;
    if (x.length < 2 || y.length < 2) return 0;
    const bx = bigrams(x);
    const by = bigrams(y);
    let overlap = 0;
    for (const [g, n] of bx) overlap += Math.min(n, by.get(g) ?? 0);
    return (2 * overlap) / (x.length - 1 + (y.length - 1));
}

/** How well a line matches a label: text similarity, or the label sitting inside a longer line. */
export function labelScore(label: string, line: string): number {
    const l = normalize(label);
    const t = normalize(line);
    if (!l || !t) return 0;
    let score = dice(l, t);
    if (t.includes(l)) score = Math.max(score, 0.7 + 0.3 * (l.length / t.length));
    return score;
}

export const MIN_LABEL_SCORE = 0.55;

/**
 * Index of the line holding `label`, or -1. Forms list their blanks top to bottom, so a
 * line before `after` is penalised, and lines in `used` (already given to another label)
 * are skipped.
 */
export function findLine(label: string, lines: Line[], opts: { after?: number; used?: ReadonlySet<number> } = {}): number {
    const after = opts.after ?? -1;
    let best = -1;
    let bestScore = 0;
    lines.forEach((line, i) => {
        if (opts.used?.has(i)) return;
        const score = labelScore(label, line.text) - (i < after ? 0.1 : 0);
        if (score > bestScore) { best = i; bestScore = score; }
    });
    return bestScore >= MIN_LABEL_SCORE ? best : -1;
}

export interface Placement {
    page: number;
    /** Left edge of the answer. */
    x: number;
    /** Text baseline. */
    y: number;
    /** Font size in page pixels. */
    size: number;
}

/** Where a label sits: a run of words (start..end, inclusive) on one line. */
export interface LabelHit {
    line: number;
    start: number;
    end: number;
    score: number;
}

const CANDIDATES_PER_LABEL = 8;

/** "7." or "8)": the number that starts the next field on the same line. */
const FIELD_NUMBER = /^\(?\d{1,2}[.)]$/;

/**
 * Finds where each label is printed. Every label is matched against every short run of
 * words on every line, so a garbled neighbour ("Name of the AppliICANt ©.....") does not
 * hide the label and two labels can share one line ("District ... PIN Code ..."). Labels
 * then claim their best runs, strongest match first, and a run is never given twice. Pass
 * ALL labels, including signature and photo ones: they must claim their own lines so that
 * "Signature of the Applicant" is never taken for "Name of the Applicant".
 */
export function locateLabels(labels: string[], lines: Line[]): Array<LabelHit | null> {
    const candidates: Array<LabelHit & { item: number }> = [];
    labels.forEach((label, item) => {
        const n = Math.max(1, normalize(label).split(' ').filter(Boolean).length);
        const found: LabelHit[] = [];
        lines.forEach((line, li) => {
            const words = line.words;
            for (const len of new Set([Math.max(1, n - 1), n, n + 1])) {
                for (let start = 0; start + len <= words.length; start++) {
                    const text = words.slice(start, start + len).map((w) => w.text).join(' ');
                    const score = dice(label, text);
                    if (score >= MIN_LABEL_SCORE) found.push({ line: li, start, end: start + len - 1, score });
                }
            }
        });
        found.sort((a, b) => b.score - a.score);
        for (const hit of found.slice(0, CANDIDATES_PER_LABEL)) candidates.push({ ...hit, item });
    });
    candidates.sort((a, b) => b.score - a.score || a.item - b.item);

    const result: Array<LabelHit | null> = labels.map(() => null);
    const claimed = new Map<number, Array<[number, number]>>();
    for (const c of candidates) {
        if (result[c.item]) continue;
        const taken = claimed.get(c.line) ?? [];
        if (taken.some(([s, e]) => c.start <= e && s <= c.end)) continue;
        taken.push([c.start, c.end]);
        claimed.set(c.line, taken);
        result[c.item] = { line: c.line, start: c.start, end: c.end, score: c.score };
    }

    // A label that OCR garbled beyond matching ("PIN Code" read as "PIN (006") but that sits right
    // after the previous label's blank, behind the next field number ("7."), is read from the number.
    result.forEach((hit, item) => {
        const before = item > 0 ? result[item - 1] : null;
        if (hit || !before) return;
        const words = lines[before.line].words;
        const marker = words.findIndex((w, i) => i > before.end && FIELD_NUMBER.test(w.text));
        if (marker < 0 || marker + 1 >= words.length) return;
        const colon = words.findIndex((w, i) => i > marker && /[:：]$/.test(w.text.trim()));
        const end = colon > marker ? Math.max(marker + 1, colon - (/^[:：]+$/.test(words[colon].text.trim()) ? 1 : 0)) : marker + 1;
        const taken = claimed.get(before.line) ?? [];
        if (taken.some(([s, e]) => marker + 1 <= e && s <= end)) return;
        result[item] = { line: before.line, start: marker + 1, end, score: 0.5 };
    });
    return result;
}

/** The usual text height on the page, so every answer is the same size. */
export function baseFontSize(lines: Line[]): number {
    const heights = lines.filter((l) => l.words.length >= 3).map((l) => l.h).sort((a, b) => a - b);
    const median = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 22;
    return Math.max(12, Math.min(median * 0.88, 34));
}

/** Dots, underscores, colons, box edges and what OCR makes of them: the blank to write on. */
function isBlankish(word: Word): boolean {
    const t = word.text.trim();
    if (!t) return true;
    if (/[.…_\-–—]{4,}/u.test(t)) return true;
    // OCR often reads a dotted line as a few wide letters ("covers" 230px wide): real words are
    // about half a line-height wide per character.
    if (t.length <= 8 && word.w / t.length > word.h * 1.1) return true;
    const marks = (t.match(/[.\-_–—|=…·•:;~]/gu) ?? []).length;
    return marks / t.length >= 0.3;
}

/**
 * Where to write the answer for the label occupying words start..end of `line`: after its
 * colon, on its dotted blank (OCR turns dots into junk, so anything blank-like or short
 * counts), up to the next numbered field. If the label is boxed in, underneath instead.
 */
export function placeAnswer(line: Line, hit: Pick<LabelHit, 'start' | 'end'>, pageWidth: number, size: number): Placement {
    const baseline = line.y + line.h * 0.82;
    const words = line.words;
    const last = words[Math.min(hit.end, words.length - 1)];
    const labelRight = last ? last.x + last.w : line.x + line.w;

    const after = words.slice(hit.end + 1);
    const stop = after.findIndex((w) => FIELD_NUMBER.test(w.text));
    const bound = stop >= 0 ? after[stop] : undefined;
    const between = stop >= 0 ? after.slice(0, stop) : after;

    // A colon or a blank-looking word marks the place to write. Something else right after the
    // label is another column, so the answer goes underneath.
    const colon = between.find((w) => /^[:：;]+$/.test(w.text.trim()) || /[:：]$/.test(w.text.trim()));
    const blank = between.find((w) => isBlankish(w));
    if (between.length > 0 && !colon && !blank) {
        return { page: line.page, x: line.x, y: baseline + line.h * 1.15, size };
    }
    const x = colon ? colon.x + colon.w + size * 0.5 : blank ? blank.x + size * 0.7 : labelRight + size * 0.7;
    const room = (bound ? bound.x : pageWidth * 0.96) - x;
    if (room < size * 4) return { page: line.page, x: line.x, y: baseline + line.h * 1.15, size };
    return { page: line.page, x, y: baseline, size };
}

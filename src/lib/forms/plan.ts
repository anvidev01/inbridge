/**
 * Turns "what the form asks" + "what the person typed" into answers placed on the page.
 * Pure; runs in the browser.
 */
import type { Chip } from './export';
import type { ExplainItem } from './explain';
import type { Language } from '../chat/protocol';
import { baseFontSize, FIELD_NUMBER, isBlankish, labelScore, locateLabels, MIN_LABEL_SCORE, placeAnswer, type Line, type Word } from './layout';
import { formatDate, matchField, pickOption, type Profile } from './profile';

/** What to write for an item: a shared detail (name, date of birth...) or its own typed answer. */
export function valueFor(item: ExplainItem, index: number, profile: Profile, custom: Record<number, string>): string {
    if (item.kind !== 'text' && item.kind !== 'choice') return '';
    const raw = item.key ? profile[item.key] : custom[index];
    const value = (raw ?? '').trim();
    if (!value) return '';
    return item.key === 'dob' ? formatDate(value) : value;
}

/** The pieces of a line that could be a printed option ("Male/Female"), each with a position. */
function optionWords(line: Line): Word[] {
    const out: Word[] = [];
    for (const w of line.words) {
        const parts = w.text.split(/[/|,]+/).filter(Boolean);
        let at = 0;
        for (const part of parts) {
            const start = w.text.indexOf(part, at);
            out.push({ text: part.replace(/[^\p{L}\p{M}\p{N}]/gu, ''), x: w.x + (start / w.text.length) * w.w, y: w.y, w: (part.length / w.text.length) * w.w, h: w.h });
            at = start + part.length;
        }
    }
    return out.filter((w) => w.text);
}

export function planOverlay(
    items: ExplainItem[],
    profile: Profile,
    custom: Record<number, string>,
    pages: Array<{ width: number; lines: Line[] }>,
): Chip[] {
    const lines = pages.flatMap((p) => p.lines);
    // All items take part (signature, photo, office-use too) so each claims its own line.
    const hits = locateLabels(items.map((it) => it.label), lines);
    const sizeOf = (page: number) => baseFontSize(pages[page]?.lines ?? []);
    const chips: Chip[] = [];
    let previous: Chip | undefined;

    items.forEach((item, index) => {
        const text = valueFor(item, index, profile, custom);
        if (!text) return;
        const hit = hits[index];
        if (!hit) {
            // Not found on the page: put it just under the previous answer, flagged for the person to drag.
            const size = previous?.size ?? 22;
            const chip: Chip = {
                id: `c${index}`, label: item.label, text, page: previous?.page ?? 0,
                x: previous?.x ?? 24, y: previous ? previous.y + size * 1.4 : 56, size, located: false,
            };
            chips.push(chip);
            previous = chip;
            return;
        }
        const line = lines[hit.line];
        const size = sizeOf(line.page);

        if (item.kind === 'choice') {
            const options = optionWords(line);
            const picked = pickOption(text, options.map((o) => o.text));
            const word = picked ? options.find((o) => o.text === picked) : undefined;
            if (word) {
                const chip: Chip = {
                    id: `c${index}`, label: item.label, text, page: line.page, x: word.x, y: line.y + line.h * 0.82,
                    size, located: true, circle: { w: word.w, h: word.h },
                };
                chips.push(chip);
                previous = chip;
                return;
            }
        }
        const place = placeAnswer(line, hit, pages[line.page]?.width ?? 1600, size);
        const chip: Chip = { id: `c${index}`, label: item.label, text, ...place, located: true };
        chips.push(chip);
        previous = chip;
    });
    return chips;
}

/**
 * For each PDF form field the rules do not already recognise, the index of the explained item
 * it belongs to (by name), or nothing. Strongest matches first, so "Aadhaar Number" cannot take
 * the "Ward Number" item just because both say "number".
 */
export function matchFieldsToItems(fieldNames: string[], items: ExplainItem[]): Map<string, number> {
    const pairs: Array<{ name: string; item: number; score: number }> = [];
    for (const name of fieldNames) {
        if (matchField(name)) continue;
        const readable = name.replace(/[_\-.[\]()]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
        items.forEach((item, i) => {
            if (item.kind !== 'text' && item.kind !== 'choice') return;
            const score = labelScore(readable, item.label);
            if (score >= MIN_LABEL_SCORE) pairs.push({ name, item: i, score });
        });
    }
    pairs.sort((a, b) => b.score - a.score);
    const out = new Map<string, number>();
    const taken = new Set<number>();
    for (const p of pairs) {
        if (out.has(p.name) || taken.has(p.item)) continue;
        out.set(p.name, p.item);
        taken.add(p.item);
    }
    return out;
}

const OWN_NAME_MEANING: Record<Language, string> = { en: 'Your full name', hi: 'आपका पूरा नाम', hinglish: 'Aapka poora naam' };

/** The printed label at the start of a line: after its number, up to the colon or the blank. */
function labelPart(line: Line): string {
    const words: string[] = [];
    for (const w of line.words) {
        if (words.length === 0 && FIELD_NUMBER.test(w.text)) continue;
        if (isBlankish(w) || /[:：]$/.test(w.text)) { if (/[:：]$/.test(w.text) && w.text.length > 1) words.push(w.text.replace(/[:：]+$/, '')); break; }
        words.push(w.text);
        if (words.length >= 6) break;
    }
    return words.join(' ');
}

/**
 * The AI occasionally leaves out the blank for the applicant's own name when its label was
 * damaged by OCR. A form that never asks for your name is the worst miss, so if no item is the
 * applicant's name but a line no item has claimed reads like one, that blank is added.
 */
export function ensureNameItem(items: ExplainItem[], lines: Line[], language: Language): ExplainItem[] {
    if (items.some((it) => it.key === 'full_name' || it.key === 'first_name')) return items;
    const hits = locateLabels(items.map((it) => it.label), lines);
    const claimed = new Set(hits.filter((h): h is NonNullable<typeof h> => !!h).map((h) => h.line));
    for (let i = 0; i < lines.length; i++) {
        if (claimed.has(i)) continue;
        const label = labelPart(lines[i]);
        if (label && matchField(label) === 'full_name') {
            return [{ label, meaning: OWN_NAME_MEANING[language], key: 'full_name', kind: 'text' }, ...items];
        }
    }
    return items;
}

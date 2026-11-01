/**
 * Extract structured sections from answer markdown: the documents checklist
 * (F8) and the complaint draft (F9). Both only read what the answer already
 * says; nothing is added.
 */
import { stripCitations } from './citations';
import { stripMarkdown } from './text';

const DOCS_HEADING = /(documents?\s+(needed|required)|required\s+documents?|आवश्यक\s+दस्तावेज|ज़रूरी\s+दस्तावेज|जरूरी\s+दस्तावेज|zaroori\s+documents?)/i;
const DRAFT_HEADING = /(draft\s+(of\s+)?(the\s+)?(complaint|grievance)|(complaint|grievance)\s+draft|शिकायत\s+(का\s+)?(मसौदा|ड्राफ्ट)|complaint\s+ka\s+draft)/i;

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const MAX_ITEMS = 30;

interface HeadingInfo {
    text: string;
    /** 1-6 for "#" headings, 7 for a bold-only or "Title:" line. */
    level: number;
}

/** Is this line a heading? Recognises "# x", "**x**" on its own, and a short "x:" line. */
function headingOf(line: string): HeadingInfo | null {
    const t = line.trim();
    if (!t || LIST_ITEM.test(line)) return null;
    const hash = /^(#{1,6})\s+(.*?)\s*#*$/.exec(t);
    if (hash) return { text: hash[2], level: hash[1].length };
    const bold = /^(\*\*|__)(.+?)\1:?$/.exec(t);
    if (bold) return { text: bold[2], level: 7 };
    if (t.length <= 80 && t.endsWith(':')) return { text: t.slice(0, -1), level: 7 };
    return null;
}

/** Inline markdown of one item to plain text. */
function plainItem(text: string): string {
    return stripMarkdown(stripCitations(text)).replace(/\s+/g, ' ').trim();
}

export interface Checklist {
    heading: string;
    items: string[];
}

/**
 * The bullet items under a "Documents needed" / "Required documents" /
 * "आवश्यक दस्तावेज" heading. Nested bullets are folded into their parent
 * ("Identity proof: Aadhaar, Voter ID"). Returns null when there is no such
 * section or it has no list items.
 */
export function extractChecklist(md: string): Checklist | null {
    const lines = md.split('\n');
    const start = lines.findIndex((l) => {
        const h = headingOf(l);
        return h !== null && DOCS_HEADING.test(h.text);
    });
    if (start === -1) return null;

    const heading = plainItem(headingOf(lines[start])!.text);
    const items: { text: string; children: string[] }[] = [];
    let baseIndent = -1;
    let introLines = 0;

    for (const line of lines.slice(start + 1)) {
        if (!line.trim()) continue;
        // A plain "Keep these ready:" line before the list is a lead-in, not a new section.
        const isLeadIn = items.length === 0 && line.trim().endsWith(':') && !/^(#|\*\*|__)/.test(line.trim());
        if (headingOf(line) && !isLeadIn) break;
        const m = LIST_ITEM.exec(line);
        if (!m) {
            if (items.length > 0) break;
            // Allow a short lead-in such as "Keep these ready:" before the list.
            if (++introLines > 2) return null;
            continue;
        }
        const indent = m[1].replace(/\t/g, '    ').length;
        if (baseIndent === -1) baseIndent = indent;
        if (indent > baseIndent && items.length > 0) {
            items[items.length - 1].children.push(plainItem(m[3]));
        } else {
            items.push({ text: plainItem(m[3]), children: [] });
        }
    }

    const out = items
        .map(({ text, children }) => {
            if (children.length === 0) return text;
            const parent = text.replace(/[:\s]+$/, '');
            return `${parent}: ${children.join(', ')}`;
        })
        .filter(Boolean)
        .slice(0, MAX_ITEMS);
    return out.length > 0 ? { heading, items: out } : null;
}

/**
 * The text of a "Draft complaint" section, as plain text ready to paste into
 * CPGRAMS. Runs to the next heading of the same or higher level (or a "---"
 * rule, or the end). A fenced block directly under the heading is taken as-is.
 */
export function extractComplaintDraft(md: string): string | null {
    const lines = md.split('\n');
    const start = lines.findIndex((l) => {
        const h = headingOf(l);
        return h !== null && DRAFT_HEADING.test(h.text);
    });
    if (start === -1) return null;
    const level = headingOf(lines[start])!.level;

    const body: string[] = [];
    for (const line of lines.slice(start + 1)) {
        if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) break;
        const h = /^(#{1,6})\s/.exec(line.trim());
        if (h && h[1].length <= Math.min(level, 6)) break;
        body.push(line);
    }

    const raw = body.join('\n').trim();
    const fenced = /^```[^\n]*\n([\s\S]*?)```/.exec(raw);
    const draft = fenced ? fenced[1].trim() : stripMarkdown(stripCitations(raw));
    return draft ? draft : null;
}

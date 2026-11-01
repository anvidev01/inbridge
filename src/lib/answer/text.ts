/**
 * Plain-text transforms of an answer: display cleanup, copy, share and
 * read-aloud text. Pure functions so they can be unit-tested without a DOM.
 */
import type { Citation } from '@/lib/chat/protocol';
import { stripCitations } from './citations';

/**
 * Remove protocol blocks that must never be shown. The server is supposed to
 * strip these, but an in-flight stream can still contain the start of a
 * ---FOLLOWUPS--- block before the server cuts it, and threads saved before
 * the data-part protocol still carry the old ---SOURCES--- prefix.
 */
export function cleanAnswerText(raw: string): string {
    let text = raw;
    const srcStart = text.indexOf('---SOURCES---');
    if (srcStart !== -1) {
        const srcEnd = text.indexOf('---END_SOURCES---', srcStart);
        text = srcEnd === -1
            ? text.slice(0, srcStart)
            : text.slice(0, srcStart) + text.slice(srcEnd + '---END_SOURCES---'.length);
    }
    const followups = text.indexOf('---FOLLOWUPS');
    if (followups !== -1) text = text.slice(0, followups);
    // A partial marker at the very end of a streaming chunk ("---FOLL").
    text = text.replace(/\n-{3}[A-Z_]*$/, '');
    return text.trim();
}

/** Markdown to readable plain text. Keeps link text; drops URLs only if asked. */
export function stripMarkdown(md: string, { dropUrls = false }: { dropUrls?: boolean } = {}): string {
    let text = md
        // Fenced code blocks: keep the code, drop the fences.
        .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        // Images, then links: keep the label.
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, '$1')
        // Headings, blockquotes, list markers, horizontal rules.
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        .replace(/^\s*>\s?/gm, '')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, '')
        // Table syntax: separator rows, then pipes.
        .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/gm, '')
        .replace(/\s*\|\s*/g, ' ')
        // Emphasis and strikethrough.
        .replace(/(\*\*|__)(.+?)\1/g, '$2')
        .replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, '$1$2')
        .replace(/~~(.+?)~~/g, '$1')
        // Inline HTML tags.
        .replace(/<[^>]+>/g, '');

    if (dropUrls) text = text.replace(/\bhttps?:\/\/\S+/g, '');

    return text
        .split('\n')
        .map((line) => line.replace(/[ \t]+/g, ' ').trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** Numbered source list, "[1] Title: https://…", one per line. */
export function formatSourceList(sources: Citation[]): string {
    return sources.map((s) => `[${s.n}] ${s.title}: ${s.url}`).join('\n');
}

/**
 * What the Copy button puts on the clipboard: the answer as written (so its
 * [n] markers still line up) followed by the numbered source list.
 */
export function buildCopyText(answer: string, sources: Citation[], sourcesLabel = 'Sources'): string {
    const body = answer.trim();
    if (sources.length === 0) return body;
    return `${body}\n\n${sourcesLabel}:\n${formatSourceList(sources)}`;
}

/** Cut at a word boundary and add an ellipsis when longer than `max` characters. */
export function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const space = cut.lastIndexOf(' ');
    return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export interface ShareTextOptions {
    sourcesLabel?: string;
    /** Footer line naming InBridge and its site URL. */
    footer: string;
    /** Max characters of answer summary. WhatsApp handles long text, but a summary reads better. */
    maxSummary?: number;
    maxSources?: number;
}

/** Share text: plain-text summary, source URLs, then the InBridge footer. */
export function buildShareText(answer: string, sources: Citation[], opts: ShareTextOptions): string {
    const { sourcesLabel = 'Sources', footer, maxSummary = 700, maxSources = 5 } = opts;
    const plain = stripMarkdown(stripCitations(answer));
    const parts = [truncate(plain, maxSummary)];
    if (sources.length > 0) {
        const urls = sources.slice(0, maxSources).map((s) => s.url);
        parts.push(`${sourcesLabel}:\n${urls.join('\n')}`);
    }
    parts.push(footer);
    return parts.join('\n\n');
}

/** WhatsApp "click to chat" link with prefilled text and no recipient. */
export function whatsappShareUrl(text: string): string {
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

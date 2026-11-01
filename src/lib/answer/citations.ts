/**
 * Inline citation parsing for answer text.
 *
 * The model cites context items as [1], [2] or [1, 3]. Only numbers that exist
 * in the message's data-sources array become citation chips; anything else
 * (a hallucinated [7] when there are 3 sources, a year in brackets, a partial
 * "[1" while streaming) stays as plain text so the UI never links to a source
 * that was not actually retrieved.
 */

export type CitationSegment =
    | { type: 'text'; value: string }
    | { type: 'cite'; n: number };

/** [1] / [1,2] / [1, 2, 3]. Two-digit cap keeps "[2024]" out. */
const CITATION_PATTERN = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g;

/**
 * Split text into plain text and citation segments.
 * `max` is the number of sources; valid markers are 1..max.
 */
export function splitCitations(text: string, max: number): CitationSegment[] {
    const segments: CitationSegment[] = [];
    let buffer = '';
    let last = 0;

    const flush = () => {
        if (buffer) segments.push({ type: 'text', value: buffer });
        buffer = '';
    };

    for (const match of text.matchAll(CITATION_PATTERN)) {
        const start = match.index ?? 0;
        buffer += text.slice(last, start);
        last = start + match[0].length;

        const numbers = match[1].split(',').map((s) => Number(s.trim()));
        if (numbers.every((n) => n < 1 || n > max)) {
            // Nothing valid inside: leave the marker exactly as written.
            buffer += match[0];
            continue;
        }
        for (const n of numbers) {
            if (n >= 1 && n <= max) {
                flush();
                segments.push({ type: 'cite', n });
            } else {
                buffer += `[${n}]`;
            }
        }
    }

    buffer += text.slice(last);
    flush();
    return segments;
}

/** Remove every [n]-style marker (valid or not), e.g. before reading aloud. */
export function stripCitations(text: string): string {
    return text.replace(CITATION_PATTERN, '').replace(/[ \t]+([.,;:!?।])/g, '$1');
}

/** Hostname without "www.", or '' for an unparseable URL. */
export function hostOf(url: string): string {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return '';
    }
}

/** Client-side mirror of isGovUrl in rag-engine.ts (which is server-only). */
export function isGovHost(host: string): boolean {
    const h = host.toLowerCase();
    return ['gov.in', 'nic.in'].some((d) => h === d || h.endsWith(`.${d}`));
}

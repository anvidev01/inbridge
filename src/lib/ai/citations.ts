/**
 * Numbers retrieved documents once, so the [n] the model is told to cite and
 * the Citation[] the UI renders are guaranteed to agree.
 */

import type { Citation } from '../chat/protocol';
import { displayHost, isGovUrl } from './gov-url';
import type { PromptSource } from './system-prompt';

/** A retrieved document, as rag-engine returns it. */
export interface RetrievedDoc {
    title: string;
    url: string;
    content: string;
}

/**
 * Drops documents without an http(s) URL (they could not be linked, so they
 * are not offered to the model either) and duplicate URLs, then numbers the
 * rest from 1.
 */
export function buildSources(docs: RetrievedDoc[]): { citations: Citation[]; promptSources: PromptSource[] } {
    const citations: Citation[] = [];
    const promptSources: PromptSource[] = [];
    const seen = new Set<string>();

    for (const doc of docs) {
        const url = (doc.url || '').trim();
        const host = displayHost(url);
        if (!host || seen.has(url) || !doc.content?.trim()) continue;
        seen.add(url);

        const n = citations.length + 1;
        const title = (doc.title || '').replace(/\s+/g, ' ').trim() || host;
        citations.push({ n, title, url, host, official: isGovUrl(url) });
        promptSources.push({ n, title, url, content: doc.content.trim() });
    }
    return { citations, promptSources };
}

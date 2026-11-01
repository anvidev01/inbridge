/**
 * Pure helpers for MarkdownRenderer: link policy, link-label text and a stable
 * key for a citation list.
 */
import type { Citation } from '@/lib/chat/protocol';
import { hostOf, isGovHost } from './citations';

/** Minimal hast shape (react-markdown passes `node` as a hast Element). */
export interface HastLike {
    type: string;
    value?: string;
    children?: HastLike[];
}

/** Concatenated text of a hast node and its descendants. */
export function hastText(node: HastLike | null | undefined): string {
    if (!node) return '';
    if (node.type === 'text') return node.value ?? '';
    return (node.children ?? []).map(hastText).join('');
}

/**
 * Link policy (approved): answers are model output, so links are not trusted
 * by default.
 *  - tel:/mailto:/sms: are shown as plain text. Helplines and addresses must
 *    come from cited sources, not from a link the model wrote.
 *  - Relative / in-page links (no http(s) scheme) stay ordinary links.
 *  - An http(s) link is clickable (new tab) only if its host is a .gov.in /
 *    .nic.in domain or a host this answer actually cited. Anything else is
 *    rendered as text with its host shown and an "unverified" tooltip.
 */
export type LinkDecision =
    | { kind: 'text' }
    | { kind: 'internal' }
    | { kind: 'external'; host: string; showHost: boolean }
    | { kind: 'unverified'; host: string; showHost: boolean };

export function classifyLink(href: string, label: string, citedHosts: ReadonlySet<string>): LinkDecision {
    if (/^(tel|mailto|sms):/i.test(href)) return { kind: 'text' };
    if (!/^https?:\/\//i.test(href)) return { kind: 'internal' };
    const host = hostOf(href);
    const showHost = Boolean(host) && !label.toLowerCase().includes(host);
    if (host && (isGovHost(host) || citedHosts.has(host))) return { kind: 'external', host, showHost };
    return { kind: 'unverified', host, showHost };
}

/**
 * Content key for a citation list. The AI SDK clones the in-flight message on
 * every streamed chunk, so the array reference changes even when the sources
 * do not; memoising on this string keeps derived values stable.
 */
export function citationsKey(citations: readonly Citation[]): string {
    return JSON.stringify(citations.map((c) => [c.n, c.url, c.host, c.title, Boolean(c.official)]));
}

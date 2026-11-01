'use client';

import React, { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

import type { Citation } from '@/lib/chat/protocol';
import { CitationChip } from '@/components/answer/CitationChip';
import { hostOf, isGovHost, splitCitations } from '@/lib/answer/citations';
import { answerStrings, type AnswerStrings } from '@/lib/answer/strings';

interface MarkdownRendererProps {
    content: string;
    /** Sources for this answer; [n] markers with 1 <= n <= length become chips. */
    citations?: Citation[];
    /** Called when a citation chip is clicked. */
    onCitationJump?: (n: number) => void;
    strings?: AnswerStrings;
}

// ── remark plugin: [n] markers -> <sup data-cite="n"> ─────────────────────
// Works on the parsed tree, so markers inside code spans/blocks are never
// touched, and re-runs on every streamed chunk (a partial "[1" stays text).

interface MdNode {
    type: string;
    value?: string;
    children?: MdNode[];
    data?: { hName?: string; hProperties?: Record<string, unknown> };
}

const NO_CHIPS_INSIDE = new Set(['link', 'linkReference']);

function remarkCitations(options: { max: number }) {
    const { max } = options;
    const walk = (node: MdNode) => {
        if (!node.children || NO_CHIPS_INSIDE.has(node.type)) return;
        node.children = node.children.flatMap((child) => {
            if (child.type !== 'text' || !child.value) {
                walk(child);
                return [child];
            }
            const segments = splitCitations(child.value, max);
            if (segments.length === 1 && segments[0].type === 'text') return [child];
            return segments.map((seg): MdNode =>
                seg.type === 'text'
                    ? { type: 'text', value: seg.value }
                    : {
                        type: 'citationRef',
                        data: { hName: 'sup', hProperties: { dataCite: seg.n } },
                        children: [{ type: 'text', value: `[${seg.n}]` }],
                    }
            );
        });
    };
    return (tree: MdNode) => {
        if (max > 0) walk(tree);
    };
}

// ── Styling ───────────────────────────────────────────────────────────────
// @tailwindcss/typography with its colour variables pointed at the theme
// tokens, so one set of classes works in both themes (no prose-invert needed:
// the tokens already flip with data-theme). Code highlighting uses a minimal
// token-based palette instead of a highlight.js theme stylesheet.
const PROSE = [
    'prose max-w-[68ch] break-words text-base leading-[1.7]',
    '[--tw-prose-body:var(--fg)] [--tw-prose-headings:var(--fg)] [--tw-prose-lead:var(--fg)]',
    '[--tw-prose-links:var(--accent)] [--tw-prose-bold:var(--fg)] [--tw-prose-counters:var(--muted)]',
    '[--tw-prose-bullets:var(--muted)] [--tw-prose-hr:var(--line)] [--tw-prose-quotes:var(--muted)]',
    '[--tw-prose-quote-borders:var(--line)] [--tw-prose-captions:var(--muted)] [--tw-prose-code:var(--fg)]',
    '[--tw-prose-pre-code:var(--fg)] [--tw-prose-pre-bg:var(--surface-2)] [--tw-prose-th-borders:var(--line)]',
    '[--tw-prose-td-borders:var(--line)] [--tw-prose-kbd:var(--fg)]',
    'prose-headings:font-semibold prose-headings:tracking-normal prose-h1:text-xl prose-h2:text-lg prose-h3:text-lg prose-h4:text-base',
    'prose-headings:mt-6 prose-headings:mb-2 prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1',
    'prose-a:underline-offset-2 prose-a:break-anywhere',
    // Inline code only; code inside <pre> is reset below.
    'prose-code:before:content-none prose-code:after:content-none',
    '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-surface-2 [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5',
    '[&_:not(pre)>code]:text-[0.875em] [&_:not(pre)>code]:font-normal [&_:not(pre)>code]:break-anywhere',
    // highlight.js classes -> tokens.
    '[&_.hljs-keyword]:text-accent [&_.hljs-built_in]:text-accent [&_.hljs-title]:text-accent',
    '[&_.hljs-string]:text-official [&_.hljs-attr]:text-official [&_.hljs-number]:text-danger [&_.hljs-literal]:text-danger',
    '[&_.hljs-comment]:text-muted [&_.hljs-comment]:italic [&_.hljs-meta]:text-muted',
].join(' ');

// ── Component ─────────────────────────────────────────────────────────────

export function MarkdownRenderer({ content, citations = [], onCitationJump, strings }: MarkdownRendererProps) {
    const t = strings ?? answerStrings('en');

    const components = useMemo<Components>(() => {
        const byNumber = new Map(citations.map((c) => [c.n, c]));
        const citedHosts = new Set(citations.map((c) => c.host));

        return {
            sup: ({ node, ...props }) => {
                void node;
                const n = Number((props as Record<string, unknown>)['data-cite']);
                const citation = Number.isFinite(n) ? byNumber.get(n) : undefined;
                if (!citation) return <sup {...props} />;
                return <CitationChip citation={citation} strings={t} onJump={(k) => onCitationJump?.(k)} />;
            },

            a: ({ node, href = '', children, ...props }) => {
                void node;
                // tel:/mailto: from the model are not trusted (helplines must come from cited sources).
                if (/^(tel|mailto|sms):/i.test(href)) return <span>{children}</span>;
                if (!/^https?:\/\//i.test(href)) return <a href={href} {...props}>{children}</a>;

                const host = hostOf(href);
                const label = React.Children.toArray(children).join('');
                const showHost = host && !label.toLowerCase().includes(host);
                // Only link to government domains or hosts this answer actually cited.
                if (!isGovHost(host) && !citedHosts.has(host)) {
                    return (
                        <span title={t.unverifiedLink}>
                            {children}
                            {showHost && <span className="text-sm text-muted"> ({host})</span>}
                        </span>
                    );
                }
                return (
                    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                        {children}
                        {showHost && <span className="text-sm font-normal text-muted no-underline"> ({host})</span>}
                        <span className="sr-only"> {t.newTab}</span>
                    </a>
                );
            },

            pre: ({ node, children, ...props }) => {
                void node;
                return (
                    <pre
                        {...props}
                        className="not-prose my-4 overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-sm leading-relaxed text-fg"
                    >
                        {children}
                    </pre>
                );
            },

            table: ({ node, ...props }) => {
                void node;
                return (
                    <div className="my-4 overflow-x-auto rounded-lg border border-line">
                        <table className="my-0 w-full text-sm" {...props} />
                    </div>
                );
            },
            th: ({ node, ...props }) => {
                void node;
                return <th className="bg-surface-2 px-3 py-2 text-left align-top font-semibold break-words" {...props} />;
            },
            td: ({ node, ...props }) => {
                void node;
                return <td className="px-3 py-2 align-top break-words" {...props} />;
            },
        };
    }, [citations, onCitationJump, t]);

    const remarkPlugins = useMemo(
        () => [remarkGfm, [remarkCitations, { max: citations.length }]] as NonNullable<React.ComponentProps<typeof ReactMarkdown>['remarkPlugins']>,
        [citations.length]
    );

    return (
        <div className={PROSE}>
            <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={[rehypeHighlight]} components={components}>
                {content}
            </ReactMarkdown>
        </div>
    );
}

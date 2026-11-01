'use client';

import React, { createContext, useContext, useMemo } from 'react';
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

import type { Citation } from '@/lib/chat/protocol';
import { CitationChip } from '@/components/answer/CitationChip';
import { splitCitations } from '@/lib/answer/citations';
import { useStableCitations } from '@/components/answer/useStableCitations';
import { classifyLink, hastText } from '@/lib/answer/markdown';
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
    'prose-a:underline-offset-2 prose-a:wrap-anywhere',
    // Inline code only; code inside <pre> is reset below.
    'prose-code:before:content-none prose-code:after:content-none',
    '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-surface-2 [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5',
    '[&_:not(pre)>code]:text-[0.875em] [&_:not(pre)>code]:font-normal [&_:not(pre)>code]:wrap-anywhere',
    // highlight.js classes -> tokens.
    '[&_.hljs-keyword]:text-accent [&_.hljs-built_in]:text-accent [&_.hljs-title]:text-accent',
    '[&_.hljs-string]:text-official [&_.hljs-attr]:text-official [&_.hljs-number]:text-danger [&_.hljs-literal]:text-danger',
    '[&_.hljs-comment]:text-muted [&_.hljs-comment]:italic [&_.hljs-meta]:text-muted',
].join(' ');

// ── Element renderers ─────────────────────────────────────────────────────
// Module-scope components, so their identity never changes between renders.
// (A components map rebuilt per render makes React unmount and remount every
// chip and link on each streamed chunk: open popovers close, focus is lost.)
// Per-answer data comes in through context instead.

interface MarkdownContextValue {
    byNumber: Map<number, Citation>;
    citedHosts: Set<string>;
    onCitationJump?: (n: number) => void;
    strings: AnswerStrings;
}

const MarkdownContext = createContext<MarkdownContextValue>({
    byNumber: new Map(),
    citedHosts: new Set(),
    strings: answerStrings('en'),
});

type Props<T extends keyof React.JSX.IntrinsicElements> = React.ComponentProps<T> & ExtraProps;

function MdSup({ node, ...props }: Props<'sup'>) {
    void node;
    const { byNumber, onCitationJump, strings } = useContext(MarkdownContext);
    const n = Number((props as Record<string, unknown>)['data-cite']);
    const citation = Number.isFinite(n) ? byNumber.get(n) : undefined;
    if (!citation) return <sup {...props} />;
    return <CitationChip citation={citation} strings={strings} onJump={onCitationJump ?? noop} />;
}

/** Link policy: see classifyLink in src/lib/answer/markdown.ts. */
function MdLink({ node, href = '', children, ...props }: Props<'a'>) {
    const { citedHosts, strings } = useContext(MarkdownContext);
    // Label from the hast text nodes, so formatted labels (**bold**) work.
    const decision = classifyLink(href, hastText(node), citedHosts);
    switch (decision.kind) {
        case 'text':
            return <span>{children}</span>;
        case 'internal':
            return <a href={href} {...props}>{children}</a>;
        case 'unverified':
            return (
                <span title={strings.unverifiedLink}>
                    {children}
                    {decision.showHost && <span className="text-sm text-muted"> ({decision.host})</span>}
                </span>
            );
        case 'external':
            return (
                <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                    {children}
                    {decision.showHost && <span className="text-sm font-normal text-muted no-underline"> ({decision.host})</span>}
                    <span className="sr-only"> {strings.newTab}</span>
                </a>
            );
    }
}

function MdPre({ node, children, ...props }: Props<'pre'>) {
    void node;
    return (
        <pre
            {...props}
            className="not-prose my-4 overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-sm leading-relaxed text-fg"
        >
            {children}
        </pre>
    );
}

function MdTable({ node, ...props }: Props<'table'>) {
    void node;
    return (
        <div className="my-4 overflow-x-auto rounded-lg border border-line">
            <table className="my-0 w-full text-sm" {...props} />
        </div>
    );
}

function MdTh({ node, ...props }: Props<'th'>) {
    void node;
    return <th className="bg-surface-2 px-3 py-2 text-left align-top font-semibold break-words" {...props} />;
}

function MdTd({ node, ...props }: Props<'td'>) {
    void node;
    return <td className="px-3 py-2 align-top break-words" {...props} />;
}

function noop() {}

const COMPONENTS: Components = { sup: MdSup, a: MdLink, pre: MdPre, table: MdTable, th: MdTh, td: MdTd };
const REHYPE_PLUGINS = [rehypeHighlight];

// ── Component ─────────────────────────────────────────────────────────────

export function MarkdownRenderer({ content, citations = [], onCitationJump, strings }: MarkdownRendererProps) {
    const t = strings ?? answerStrings('en');

    // Same reference while the citation content is unchanged, so the context
    // value (and every chip) stays stable across streamed chunks.
    const stable = useStableCitations(citations);
    const context = useMemo<MarkdownContextValue>(() => ({
        byNumber: new Map(stable.map((c) => [c.n, c])),
        citedHosts: new Set(stable.map((c) => c.host).filter(Boolean)),
        onCitationJump,
        strings: t,
    }), [stable, onCitationJump, t]);

    const remarkPlugins = useMemo(
        () => [remarkGfm, [remarkCitations, { max: citations.length }]] as NonNullable<React.ComponentProps<typeof ReactMarkdown>['remarkPlugins']>,
        [citations.length]
    );

    return (
        <MarkdownContext.Provider value={context}>
            <div className={PROSE}>
                <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={REHYPE_PLUGINS} components={COMPONENTS}>
                    {content}
                </ReactMarkdown>
            </div>
        </MarkdownContext.Provider>
    );
}

'use client';

import React, { useState } from 'react';
import { List } from 'lucide-react';

import type { Citation } from '@/lib/chat/protocol';
import type { AnswerStrings } from '@/lib/answer/strings';
import { SourceSheet } from './SourceSheet';

/** DOM id of a source card, so citation chips can scroll to it. */
export function sourceCardId(messageId: string, n: number): string {
    return `src-${messageId}-${n}`;
}

interface SourceStripProps {
    messageId: string;
    sources: Citation[];
    strings: AnswerStrings;
    /** Card currently highlighted after a citation-chip jump. */
    highlighted: number | null;
    lang?: string;
}

/** Horizontally scrolling source cards plus a "View all N" control. */
export function SourceStrip({ messageId, sources, strings, highlighted, lang }: SourceStripProps) {
    const [sheetOpen, setSheetOpen] = useState(false);
    if (sources.length === 0) return null;

    return (
        <section aria-label={strings.sources} className="mt-6">
            <p className="mb-2 text-sm font-semibold text-muted">{strings.sources}</p>
            <ol className="hide-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                {sources.map((s) => (
                    <li key={s.n} className="shrink-0 snap-start">
                        <a
                            id={sourceCardId(messageId, s.n)}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex h-[84px] w-[168px] flex-col justify-between rounded-lg border bg-surface p-3 transition-colors hover:border-accent ${highlighted === s.n ? 'border-accent ring-2 ring-accent' : 'border-line'}`}
                        >
                            <span className="line-clamp-2 text-[13px] font-medium leading-snug text-fg">{s.title}</span>
                            <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted">
                                <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded bg-surface-2 px-1 text-[10px] font-semibold tabular-nums">
                                    {s.n}
                                </span>
                                <span className="truncate">{s.host}</span>
                                {s.official && (
                                    <span className="ml-auto shrink-0 font-semibold text-official" title={strings.officialHint}>
                                        {strings.official}
                                    </span>
                                )}
                            </span>
                            <span className="sr-only">{strings.newTab}</span>
                        </a>
                    </li>
                ))}
                {sources.length > 1 && (
                    <li className="shrink-0">
                        <button
                            type="button"
                            onClick={() => setSheetOpen(true)}
                            aria-haspopup="dialog"
                            className="flex h-[84px] min-w-[96px] flex-col items-center justify-center gap-1 rounded-lg border border-line bg-surface-2 px-3 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-fg"
                        >
                            <List size={16} aria-hidden="true" />
                            {strings.viewAll(sources.length)}
                        </button>
                    </li>
                )}
            </ol>
            <SourceSheet open={sheetOpen} onClose={() => setSheetOpen(false)} sources={sources} strings={strings} lang={lang} />
        </section>
    );
}

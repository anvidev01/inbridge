'use client';

import React, { useEffect, useId, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';

import type { Citation } from '@/lib/chat/protocol';
import type { AnswerStrings } from '@/lib/answer/strings';

interface SourceSheetProps {
    open: boolean;
    onClose: () => void;
    sources: Citation[];
    strings: AnswerStrings;
    lang?: string;
}

/**
 * Full source list in a native modal <dialog>: a bottom sheet on mobile, a
 * right-hand panel from md up. It slides in from its edge (@starting-style,
 * so browsers without it simply show it; reduced motion cuts the transition). showModal() makes the rest of the page inert
 * (which traps focus) and Esc closes it; focus returns to the opener.
 */
export function SourceSheet({ open, onClose, sources, strings, lang }: SourceSheetProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const returnFocus = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            returnFocus.current = document.activeElement as HTMLElement | null;
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    // The 'close' event fires for Esc, our close button and dialog.close().
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        const onDialogClose = () => {
            onClose();
            returnFocus.current?.focus();
            returnFocus.current = null;
        };
        dialog.addEventListener('close', onDialogClose);
        return () => dialog.removeEventListener('close', onDialogClose);
    }, [onClose]);

    // Lock background scroll while open (a modal dialog does not stop the page
    // behind a bottom sheet from scrolling on mobile).
    useEffect(() => {
        if (!open) return;
        const root = document.documentElement;
        const previous = root.style.overflow;
        root.style.overflow = 'hidden';
        return () => {
            root.style.overflow = previous;
        };
    }, [open]);

    const titleId = useId();

    return (
        <dialog
            ref={ref}
            lang={lang}
            aria-labelledby={titleId}
            // Clicks on the ::backdrop land on the <dialog> element itself.
            onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }}
            className="fixed inset-x-0 bottom-0 top-auto m-0 h-auto max-h-[85dvh] w-full max-w-none overflow-hidden rounded-t-xl border border-line bg-surface p-0 text-fg backdrop:bg-bg/70 md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:max-h-none md:w-[420px] md:rounded-none md:border-y-0 md:border-r-0 transition-[translate] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] starting:open:translate-y-full md:starting:open:translate-y-0 md:starting:open:translate-x-full backdrop:transition-opacity backdrop:duration-[260ms] starting:open:backdrop:opacity-0"
        >
            <div className="flex max-h-[inherit] flex-col md:h-full">
                <div className="flex items-center justify-between gap-2 border-b border-line py-2 pl-4 pr-2">
                    <h2 id={titleId} className="text-base font-semibold">{strings.allSources(sources.length)}</h2>
                    <button
                        type="button"
                        onClick={() => ref.current?.close()}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted transition duration-150 hover:bg-surface-2 hover:text-fg motion-safe:active:scale-[0.94] focus-visible:rounded-full!"
                    >
                        <X size={18} aria-hidden="true" />
                        <span className="sr-only">{strings.close}</span>
                    </button>
                </div>

                <ol className="flex-1 overflow-y-auto overscroll-contain p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                    {sources.map((s) => (
                        <li key={s.n}>
                            <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex gap-3 rounded-lg p-3 transition-colors duration-150 hover:bg-surface-2"
                            >
                                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-surface-2 text-xs font-semibold tabular-nums text-muted">
                                    {s.n}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium leading-snug">{s.title}</span>
                                    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                                        <span>{s.host}</span>
                                        {s.official && (
                                            <span className="font-semibold text-official" title={strings.officialHint}>{strings.official}</span>
                                        )}
                                    </span>
                                    <span className="mt-1 block text-xs text-muted wrap-anywhere">{s.url}</span>
                                </span>
                                <ExternalLink size={14} aria-hidden="true" className="mt-1 shrink-0 text-muted" />
                                <span className="sr-only">{strings.newTab}</span>
                            </a>
                        </li>
                    ))}
                </ol>
            </div>
        </dialog>
    );
}

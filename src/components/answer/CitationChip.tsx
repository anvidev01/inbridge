'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';

import type { Citation } from '@/lib/chat/protocol';
import type { AnswerStrings } from '@/lib/answer/strings';

interface CitationChipProps {
    citation: Citation;
    strings: AnswerStrings;
    /** Scroll to and highlight the matching source card. */
    onJump: (n: number) => void;
}

const POPOVER_WIDTH = 288;

/**
 * Inline [n] marker rendered as a small host chip. Hover or keyboard focus
 * opens a popover with the source title and link; click jumps to the source
 * card. On touch, the first tap opens the popover (there is no hover) and a
 * second tap jumps.
 *
 * Everything is a <span> because the chip sits inside paragraphs. The chip is
 * smaller than 44px by design (WCAG 2.5.8 exempts inline targets in text);
 * a pseudo-element widens the touch area on coarse pointers.
 */
export function CitationChip({ citation, strings, onJump }: CitationChipProps) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<React.CSSProperties>({});
    const buttonRef = useRef<HTMLButtonElement>(null);
    const wrapperRef = useRef<HTMLSpanElement>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastPointer = useRef<string>('');
    const popoverId = useId();

    const cancelClose = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        closeTimer.current = null;
    };

    const show = useCallback(() => {
        cancelClose();
        const rect = buttonRef.current?.getBoundingClientRect();
        if (rect) {
            // Fixed positioning, clamped to the viewport, so the popover can
            // never cause horizontal scroll on a 320px screen.
            const width = Math.min(POPOVER_WIDTH, window.innerWidth - 16);
            const left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8);
            const below = window.innerHeight - rect.bottom > 160;
            setPos(below
                ? { left, width, top: rect.bottom + 6 }
                : { left, width, bottom: window.innerHeight - rect.top + 6 });
        }
        setOpen(true);
    }, []);

    const hide = useCallback(() => {
        cancelClose();
        setOpen(false);
    }, []);

    const hideSoon = () => {
        cancelClose();
        closeTimer.current = setTimeout(() => setOpen(false), 150);
    };

    // A fixed popover would drift away from its chip on scroll, so close it
    // instead. Also close on a tap elsewhere (iOS does not focus buttons on
    // tap, so blur alone is not enough).
    useEffect(() => {
        if (!open) return;
        const onScroll = () => setOpen(false);
        const onOutside = (e: PointerEvent) => {
            if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
        };
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        document.addEventListener('pointerdown', onOutside);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
            document.removeEventListener('pointerdown', onOutside);
        };
    }, [open]);

    useEffect(() => cancelClose, []);

    const label = strings.sourceN(citation.n, citation.host || citation.title);

    return (
        <span
            ref={wrapperRef}
            className="relative inline"
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') show(); }}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') hideSoon(); }}
            onBlur={(e) => {
                if (!wrapperRef.current?.contains(e.relatedTarget as Node | null)) hide();
            }}
            onKeyDown={(e) => {
                if (e.key === 'Escape' && open) {
                    e.stopPropagation();
                    hide();
                    buttonRef.current?.focus();
                }
            }}
        >
            <button
                ref={buttonRef}
                type="button"
                aria-label={label}
                aria-expanded={open}
                aria-controls={open ? popoverId : undefined}
                onPointerDown={(e) => { lastPointer.current = e.pointerType; }}
                onFocus={() => { if (lastPointer.current !== 'touch') show(); }}
                onClick={() => {
                    if (lastPointer.current === 'touch' && !open) {
                        show();
                    } else {
                        hide();
                        onJump(citation.n);
                    }
                    lastPointer.current = '';
                }}
                className="relative mx-0.5 inline-flex max-w-[11rem] translate-y-[-1px] items-center gap-1 rounded-full border border-line bg-surface-2 px-1.5 py-px align-baseline text-[0.75rem] font-medium leading-5 text-muted no-underline transition-colors hover:border-accent hover:text-fg pointer-coarse:before:absolute pointer-coarse:before:-inset-2 pointer-coarse:before:content-['']"
            >
                <span className="tabular-nums text-fg">{citation.n}</span>
                <span className="truncate">{citation.host || citation.title}</span>
            </button>

            {open && (
                <span
                    id={popoverId}
                    role="group"
                    aria-label={label}
                    style={pos}
                    onPointerEnter={(e) => { if (e.pointerType === 'mouse') cancelClose(); }}
                    onPointerLeave={(e) => { if (e.pointerType === 'mouse') hideSoon(); }}
                    className="fixed z-50 block rounded-lg border border-line bg-surface p-3 text-left text-sm leading-snug text-fg shadow-sm animate-fadeIn"
                >
                    <span className="block font-medium line-clamp-3 break-anywhere">{citation.title}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                        <span className="truncate">{citation.host}</span>
                        {citation.official && (
                            <span className="shrink-0 font-semibold text-official" title={strings.officialHint}>{strings.official}</span>
                        )}
                    </span>
                    <a
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-medium text-accent underline underline-offset-2"
                    >
                        {strings.openSource}
                        <ExternalLink size={14} aria-hidden="true" />
                        <span className="sr-only">{strings.newTab}</span>
                    </a>
                </span>
            )}
        </span>
    );
}

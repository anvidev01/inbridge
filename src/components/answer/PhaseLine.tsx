'use client';

import React, { useEffect, useRef, useState } from 'react';

import type { PhaseData } from '@/lib/chat/protocol';
import type { AnswerStrings } from '@/lib/answer/strings';

/** Each phase stays on screen at least this long, so fast phases don't flicker past. */
const MIN_PHASE_MS = 300;

interface PhaseLineProps {
    /** Latest phase from the server, or null before the first one / between parts. */
    phase: PhaseData | null;
    strings: AnswerStrings;
    /** Show quiet dots while no phase has arrived yet (and no text either). */
    pending?: boolean;
}

/**
 * Live pipeline status ("Searching scheme dataset" …). Shows only phases the
 * server actually reported. Keeps the last phase when the prop goes back to
 * null, and holds each phase for MIN_PHASE_MS before switching to the next.
 * The status region is small and polite so screen readers hear each phase
 * once, never the streamed tokens.
 */
export function PhaseLine({ phase, strings, pending = false }: PhaseLineProps) {
    // Start empty even if a phase is already set: the role=status region must
    // exist before its text arrives, or screen readers skip the first phase.
    // The effect below fills it on the next tick.
    const [shown, setShown] = useState<PhaseData | null>(null);
    const shownAt = useRef(0);

    useEffect(() => {
        shownAt.current = Date.now();
    }, []);

    useEffect(() => {
        if (!phase) return;
        if (shown && shown.phase === phase.phase && shown.count === phase.count) return;
        // First fill waits 100ms so assistive tech has registered the (empty) live region.
        const wait = shown ? Math.max(0, MIN_PHASE_MS - (Date.now() - shownAt.current)) : 100;
        const timer = setTimeout(() => {
            shownAt.current = Date.now();
            setShown(phase);
        }, wait);
        return () => clearTimeout(timer);
    }, [phase, shown]);

    const label = shown ? strings.phase(shown.phase, shown.count) : '';

    return (
        <div className="mb-3 flex min-h-6 items-center gap-2 text-sm text-muted">
            {(label || pending) && (
                <span aria-hidden="true" className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
                </span>
            )}
            <span role="status" aria-live="polite" aria-atomic="true">{label}</span>
        </div>
    );
}

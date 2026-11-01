'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

import type { RetrievalSource } from '@/lib/chat/protocol';
import { FEEDBACK_REASONS, type AnswerStrings, type FeedbackReason } from '@/lib/answer/strings';
import { readStored, writeStored } from '@/lib/answer/clipboard';
import { ActionButton } from './ActionButton';

export type Rating = 'up' | 'down';

/**
 * Body POSTed to /api/feedback. Deliberately carries no question or answer
 * text: only ids, the vote, the retrieval source and the cited hostnames.
 */
export interface FeedbackPayload {
    messageId: string;
    rating: Rating;
    sourceType?: RetrievalSource;
    citationHosts: string[];
    reasons?: FeedbackReason[];
    note?: string;
}

const NOTE_MAX = 300;
const storageKey = (id: string) => `inbridge_feedback:${id}`;

async function postFeedback(payload: FeedbackPayload): Promise<boolean> {
    try {
        const res = await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
        });
        return res.ok;
    } catch {
        return false;
    }
}

interface FeedbackButtonsProps {
    messageId: string;
    sourceType?: RetrievalSource;
    citationHosts: string[];
    strings: AnswerStrings;
}

/**
 * Thumbs up/down. The vote is sent immediately on click (so closing the
 * reasons panel never loses it); a thumbs-down then opens an optional panel
 * of reason chips and a short note, which sends a second, richer event.
 * No counts are ever shown.
 */
export function FeedbackButtons({ messageId, sourceType, citationHosts, strings }: FeedbackButtonsProps) {
    const [rating, setRating] = useState<Rating | null>(() => readStored<Rating | null>(storageKey(messageId), null));
    const [panelOpen, setPanelOpen] = useState(false);
    const [reasons, setReasons] = useState<FeedbackReason[]>([]);
    const [note, setNote] = useState('');
    const [status, setStatus] = useState<'idle' | 'thanks' | 'failed'>('idle');
    const panelRef = useRef<HTMLDivElement>(null);
    const noteId = useId();

    const base = { messageId, sourceType, citationHosts };

    useEffect(() => {
        if (panelOpen) panelRef.current?.querySelector<HTMLElement>('button')?.focus();
    }, [panelOpen]);

    const vote = async (next: Rating) => {
        if (next === rating) {
            // Re-clicking thumbs-down reopens the reasons panel; the vote itself is already recorded.
            if (next === 'down') setPanelOpen(true);
            return;
        }
        const previous = rating;
        setRating(next);
        setStatus('idle');
        setPanelOpen(next === 'down');
        const ok = await postFeedback({ ...base, rating: next });
        if (ok) {
            writeStored(storageKey(messageId), next);
            if (next === 'up') setStatus('thanks');
        } else {
            // Say so plainly and un-press the button so the user can retry.
            setRating(previous);
            setPanelOpen(false);
            setStatus('failed');
        }
    };

    const sendDetails = async () => {
        setPanelOpen(false);
        const trimmed = note.trim().slice(0, NOTE_MAX);
        if (reasons.length === 0 && !trimmed) {
            setStatus('thanks');
            return;
        }
        const ok = await postFeedback({ ...base, rating: 'down', reasons, note: trimmed || undefined });
        setStatus(ok ? 'thanks' : 'failed');
    };

    const toggleReason = (r: FeedbackReason) =>
        setReasons((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

    return (
        <>
            <ActionButton
                icon={<ThumbsUp size={16} className={rating === 'up' ? 'fill-current' : ''} />}
                label={strings.helpful}
                aria-pressed={rating === 'up'}
                onClick={() => vote('up')}
                className={rating === 'up' ? 'text-accent hover:text-accent' : ''}
            />
            <ActionButton
                icon={<ThumbsDown size={16} className={rating === 'down' ? 'fill-current' : ''} />}
                label={strings.notHelpful}
                aria-pressed={rating === 'down'}
                aria-expanded={rating === 'down' ? panelOpen : undefined}
                onClick={() => vote('down')}
                className={rating === 'down' ? 'text-accent hover:text-accent' : ''}
            />

            <span className="sr-only" role="status" aria-live="polite">
                {status === 'thanks' ? strings.feedbackThanks : status === 'failed' ? strings.feedbackFailed : ''}
            </span>

            {(panelOpen || status !== 'idle') && (
                // basis-full drops the panel onto its own line inside the flex-wrap action row.
                <div className="order-last basis-full">
                    {status === 'failed' && !panelOpen && (
                        <p className="mt-1 text-sm text-danger">{strings.feedbackFailed}</p>
                    )}
                    {status === 'thanks' && !panelOpen && (
                        <p className="mt-1 text-sm text-muted">{strings.feedbackThanks}</p>
                    )}
                    {panelOpen && (
                        <div
                            ref={panelRef}
                            role="group"
                            aria-label={strings.feedbackWhat}
                            onKeyDown={(e) => { if (e.key === 'Escape') setPanelOpen(false); }}
                            className="mt-2 max-w-md rounded-lg border border-line bg-surface p-3"
                        >
                            <p className="mb-2 text-sm font-medium text-fg">{strings.feedbackWhat}</p>
                            <div className="flex flex-wrap gap-2">
                                {FEEDBACK_REASONS.map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        aria-pressed={reasons.includes(r)}
                                        onClick={() => toggleReason(r)}
                                        className={`min-h-11 rounded-full border px-3 text-sm transition-colors ${reasons.includes(r) ? 'border-accent bg-accent text-accent-fg' : 'border-line text-fg hover:bg-surface-2'}`}
                                    >
                                        {strings.reasons[r]}
                                    </button>
                                ))}
                            </div>
                            <label htmlFor={noteId} className="sr-only">{strings.feedbackNote}</label>
                            <textarea
                                id={noteId}
                                value={note}
                                maxLength={NOTE_MAX}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder={strings.feedbackNote}
                                rows={2}
                                className="mt-3 w-full resize-none rounded-lg border border-line bg-bg p-2 text-base text-fg placeholder:text-muted"
                            />
                            <div className="mt-1 flex items-center justify-between gap-2">
                                <span className="text-xs tabular-nums text-muted" aria-hidden="true">{note.length}/{NOTE_MAX}</span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPanelOpen(false)}
                                        className="min-h-11 rounded-full px-4 text-sm text-muted hover:bg-surface-2 hover:text-fg"
                                    >
                                        {strings.feedbackSkip}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={sendDetails}
                                        className="min-h-11 rounded-full bg-accent px-4 text-sm font-medium text-accent-fg"
                                    >
                                        {strings.feedbackSend}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

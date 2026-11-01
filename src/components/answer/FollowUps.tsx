import React from 'react';
import { CornerDownRight } from 'lucide-react';

import type { AnswerStrings } from '@/lib/answer/strings';

interface FollowUpsProps {
    items: string[];
    strings: AnswerStrings;
    onSelect: (text: string) => void;
}

/** Suggested next questions (from data-followups). Clicking one sends it. */
export function FollowUps({ items, strings, onSelect }: FollowUpsProps) {
    const list = items.map((s) => s.trim()).filter(Boolean).slice(0, 4);
    if (list.length === 0) return null;

    return (
        <section aria-label={strings.followUps} className="mt-6">
            <p className="mb-2 text-sm font-semibold text-muted">{strings.followUps}</p>
            <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {list.map((q) => (
                    <li key={q}>
                        <button
                            type="button"
                            onClick={() => onSelect(q)}
                            className="flex min-h-11 w-full items-center gap-2 rounded-full bg-surface px-4 py-2 text-left text-sm text-fg transition duration-150 ease-out hover:bg-surface-2 motion-safe:active:scale-[0.98] focus-visible:rounded-full! sm:w-auto"
                        >
                            <CornerDownRight size={14} aria-hidden="true" className="shrink-0 text-muted" />
                            <span className="break-words">{q}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}

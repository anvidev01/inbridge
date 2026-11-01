'use client';

import React, { useId, useState } from 'react';
import { ListChecks } from 'lucide-react';

import type { Checklist as ChecklistData } from '@/lib/answer/sections';
import type { AnswerStrings } from '@/lib/answer/strings';
import { readStored, writeStored } from '@/lib/answer/clipboard';
import { CopyButton } from './ActionButton';

interface ChecklistProps {
    messageId: string;
    checklist: ChecklistData;
    strings: AnswerStrings;
}

const storageKey = (id: string) => `inbridge_checklist:${id}`;

/**
 * The answer's own "Documents needed" bullets as tick boxes (F8). Only the
 * items the answer listed; ticks are kept in localStorage per message.
 */
export function Checklist({ messageId, checklist, strings }: ChecklistProps) {
    const [checked, setChecked] = useState<Record<string, boolean>>(() =>
        readStored<Record<string, boolean>>(storageKey(messageId), {})
    );
    const baseId = useId();

    const toggle = (item: string) => {
        setChecked((cur) => {
            const next = { ...cur, [item]: !cur[item] };
            writeStored(storageKey(messageId), next);
            return next;
        });
    };

    const done = checklist.items.filter((i) => checked[i]).length;
    const copyText = () =>
        `${checklist.heading}\n${checklist.items.map((i) => `${checked[i] ? '[x]' : '[ ]'} ${i}`).join('\n')}`;

    return (
        <section aria-labelledby={`${baseId}-title`} className="mt-6 rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id={`${baseId}-title`} className="flex items-center gap-2 text-base font-semibold text-fg">
                    <ListChecks size={18} aria-hidden="true" className="text-accent" />
                    {strings.checklistTitle}
                </h3>
                <span className="text-sm tabular-nums text-muted">{strings.checklistProgress(done, checklist.items.length)}</span>
            </div>
            <ul className="mt-2">
                {checklist.items.map((item, i) => (
                    <li key={item}>
                        <label
                            htmlFor={`${baseId}-${i}`}
                            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md py-2 text-[15px] leading-snug text-fg"
                        >
                            <input
                                id={`${baseId}-${i}`}
                                type="checkbox"
                                checked={!!checked[item]}
                                onChange={() => toggle(item)}
                                className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
                            />
                            <span className={checked[item] ? 'text-muted line-through' : ''}>{item}</span>
                        </label>
                    </li>
                ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
                <span className="text-xs text-muted">{strings.checklistDeviceNote}</span>
                <CopyButton
                    getText={copyText}
                    label={strings.copyChecklist}
                    copiedLabel={strings.copied}
                    failedLabel={strings.copyFailed}
                    alwaysShowLabel
                />
            </div>
        </section>
    );
}

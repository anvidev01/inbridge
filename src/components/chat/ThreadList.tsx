'use client';

import React, { useMemo, useState } from 'react';
import { Check, CircleAlert, Pencil, Trash2, X } from 'lucide-react';
import { HISTORY_NOTE, groupThreads, type Thread, type ThreadGroupKey } from '@/lib/history';
import type { Language } from '@/lib/chat/protocol';

interface ThreadListCopy {
    heading: string;
    groups: Record<ThreadGroupKey, string>;
    clearAll: string;
    clearAllConfirm: string;
    cancelClear: string;
    empty: string;
    saveFailed: string;
    threadName: string;
    saveName: string;
    deleteConfirm: string;
    cancelDelete: string;
    rename: (title: string) => string;
    remove: (title: string) => string;
}

export const THREAD_LIST_COPY: Record<Language, ThreadListCopy> = {
    en: {
        heading: 'History',
        groups: { today: 'Today', yesterday: 'Yesterday', week: 'Previous 7 days', older: 'Older' },
        clearAll: 'Clear all',
        clearAllConfirm: 'Clear all?',
        cancelClear: 'Cancel clearing history',
        empty: 'Your questions will appear here.',
        saveFailed: 'Couldn’t save this conversation on this device.',
        threadName: 'Thread name',
        saveName: 'Save name',
        deleteConfirm: 'Delete?',
        cancelDelete: 'Cancel delete',
        rename: (t) => `Rename “${t}”`,
        remove: (t) => `Delete “${t}”`,
    },
    hi: {
        heading: 'पिछली बातचीत',
        groups: { today: 'आज', yesterday: 'कल', week: 'पिछले 7 दिन', older: 'पुरानी' },
        clearAll: 'सब मिटाएँ',
        clearAllConfirm: 'सब मिटाएँ?',
        cancelClear: 'मिटाना रद्द करें',
        empty: 'आपके सवाल यहाँ दिखेंगे।',
        saveFailed: 'यह बातचीत इस डिवाइस पर सेव नहीं हो सकी।',
        threadName: 'बातचीत का नाम',
        saveName: 'नाम सेव करें',
        deleteConfirm: 'मिटाएँ?',
        cancelDelete: 'मिटाना रद्द करें',
        rename: (t) => `“${t}” का नाम बदलें`,
        remove: (t) => `“${t}” मिटाएँ`,
    },
    hinglish: {
        heading: 'History',
        groups: { today: 'Aaj', yesterday: 'Kal', week: 'Pichhle 7 din', older: 'Purani' },
        clearAll: 'Sab mitayein',
        clearAllConfirm: 'Sab mitayein?',
        cancelClear: 'Mitana cancel karein',
        empty: 'Aapke sawaal yahan dikhenge.',
        saveFailed: 'Yeh conversation is device par save nahi ho saki.',
        threadName: 'Thread ka naam',
        saveName: 'Naam save karein',
        deleteConfirm: 'Delete karein?',
        cancelDelete: 'Delete cancel karein',
        rename: (t) => `“${t}” ka naam badlein`,
        remove: (t) => `“${t}” delete karein`,
    },
};

interface ThreadListProps {
    language: Language;
    /** The last save to this device failed. */
    saveFailed: boolean;
    threads: Thread[];
    currentId: string | null;
    onSelect: (thread: Thread) => void;
    onRename: (id: string, title: string) => void;
    onDelete: (id: string) => void;
    onClearAll: () => void;
}

const iconButton = 'shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition-colors';

/** Local history (F4): grouped by day, with rename, delete and clear-all. */
export function ThreadList({ language, saveFailed, threads, currentId, onSelect, onRename, onDelete, onClearAll }: ThreadListProps) {
    const copy = THREAD_LIST_COPY[language];
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [confirmClear, setConfirmClear] = useState(false);

    // Grouping depends on "now"; recomputed whenever the list changes, which is often enough.
    const groups = useMemo(() => groupThreads(threads), [threads]);

    const startRename = (t: Thread) => {
        setConfirmDeleteId(null);
        setEditingId(t.id);
        setDraft(t.title);
    };

    const commitRename = () => {
        if (editingId && draft.trim()) onRename(editingId, draft);
        setEditingId(null);
    };

    return (
        <section aria-labelledby="history-heading">
            <div className="flex items-center justify-between px-3 mb-1">
                <h2 id="history-heading" className="text-xs font-semibold text-muted uppercase tracking-wider">{copy.heading}</h2>
                {threads.length > 0 && (
                    confirmClear ? (
                        <span className="flex items-center gap-1">
                            <button type="button" onClick={() => { onClearAll(); setConfirmClear(false); }} className="min-h-11 px-2 text-xs font-semibold text-danger hover:underline">
                                {copy.clearAllConfirm}
                            </button>
                            <button type="button" onClick={() => setConfirmClear(false)} aria-label={copy.cancelClear} className={iconButton}>
                                <X className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </span>
                    ) : (
                        <button type="button" onClick={() => setConfirmClear(true)} className="min-h-11 px-2 text-xs text-muted hover:text-fg">
                            {copy.clearAll}
                        </button>
                    )
                )}
            </div>
            <p className="px-3 mb-2 text-xs text-muted">{HISTORY_NOTE[language]}</p>
            <div role="status" aria-live="polite">
                {saveFailed && (
                    <p className="mx-3 mb-2 flex items-start gap-1.5 text-xs text-danger">
                        <CircleAlert className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
                        {copy.saveFailed}
                    </p>
                )}
            </div>

            {threads.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted">{copy.empty}</p>
            ) : (
                groups.map((group) => (
                    <div key={group.key} className="mb-3">
                        <h3 className="px-3 py-1 text-xs font-medium text-muted">{copy.groups[group.key]}</h3>
                        <ul className="space-y-0.5">
                            {group.threads.map((t) => {
                                const active = t.id === currentId;
                                if (editingId === t.id) {
                                    return (
                                        <li key={t.id} className="flex items-center gap-1 px-1">
                                            <label htmlFor={`rename-${t.id}`} className="sr-only">{copy.threadName}</label>
                                            <input
                                                id={`rename-${t.id}`}
                                                autoFocus
                                                value={draft}
                                                maxLength={120}
                                                onChange={(e) => setDraft(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                                                    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditingId(null); }
                                                }}
                                                onBlur={commitRename}
                                                className="flex-1 min-w-0 h-11 px-2 rounded-lg bg-bg border border-line text-base text-fg"
                                            />
                                            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={commitRename} aria-label={copy.saveName} className={iconButton}>
                                                <Check className="w-4 h-4" aria-hidden="true" />
                                            </button>
                                        </li>
                                    );
                                }
                                return (
                                    <li key={t.id} className={`group flex items-center rounded-lg ${active ? 'bg-surface-2' : 'hover:bg-surface-2'}`}>
                                        <button
                                            type="button"
                                            onClick={() => onSelect(t)}
                                            aria-current={active ? 'page' : undefined}
                                            className={`flex-1 min-w-0 min-h-11 px-3 text-left text-sm truncate ${active ? 'text-fg font-medium' : 'text-muted hover:text-fg'}`}
                                        >
                                            {t.title}
                                        </button>
                                        {confirmDeleteId === t.id ? (
                                            <>
                                                <button type="button" onClick={() => { onDelete(t.id); setConfirmDeleteId(null); }} className="shrink-0 min-h-11 px-2 text-xs font-semibold text-danger hover:underline">
                                                    {copy.deleteConfirm}
                                                </button>
                                                <button type="button" onClick={() => setConfirmDeleteId(null)} aria-label={copy.cancelDelete} className={iconButton}>
                                                    <X className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                            </>
                                        ) : (
                                            // Always visible on touch screens; on desktop they appear on hover or keyboard focus.
                                            <span className="flex lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 transition-opacity">
                                                <button type="button" onClick={() => startRename(t)} aria-label={copy.rename(t.title)} className={iconButton}>
                                                    <Pencil className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                                <button type="button" onClick={() => setConfirmDeleteId(t.id)} aria-label={copy.remove(t.title)} className={iconButton}>
                                                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))
            )}
        </section>
    );
}

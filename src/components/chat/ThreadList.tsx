'use client';

import React, { useMemo, useState } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { HISTORY_NOTE, groupThreads, type Thread, type ThreadGroupKey } from '@/lib/history';

const GROUP_LABELS: Record<ThreadGroupKey, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    week: 'Previous 7 days',
    older: 'Older',
};

interface ThreadListProps {
    threads: Thread[];
    currentId: string | null;
    onSelect: (thread: Thread) => void;
    onRename: (id: string, title: string) => void;
    onDelete: (id: string) => void;
    onClearAll: () => void;
}

const iconButton = 'shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition-colors';

/** Local history (F4): grouped by day, with rename, delete and clear-all. */
export function ThreadList({ threads, currentId, onSelect, onRename, onDelete, onClearAll }: ThreadListProps) {
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
                <h2 id="history-heading" className="text-xs font-semibold text-muted uppercase tracking-wider">History</h2>
                {threads.length > 0 && (
                    confirmClear ? (
                        <span className="flex items-center gap-1">
                            <button type="button" onClick={() => { onClearAll(); setConfirmClear(false); }} className="min-h-11 px-2 text-xs font-semibold text-danger hover:underline">
                                Clear all?
                            </button>
                            <button type="button" onClick={() => setConfirmClear(false)} aria-label="Cancel clearing history" className={iconButton}>
                                <X className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </span>
                    ) : (
                        <button type="button" onClick={() => setConfirmClear(true)} className="min-h-11 px-2 text-xs text-muted hover:text-fg">
                            Clear all
                        </button>
                    )
                )}
            </div>
            <p className="px-3 mb-2 text-xs text-muted">{HISTORY_NOTE}</p>

            {threads.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted">Your questions will appear here.</p>
            ) : (
                groups.map((group) => (
                    <div key={group.key} className="mb-3">
                        <h3 className="px-3 py-1 text-xs font-medium text-muted">{GROUP_LABELS[group.key]}</h3>
                        <ul className="space-y-0.5">
                            {group.threads.map((t) => {
                                const active = t.id === currentId;
                                if (editingId === t.id) {
                                    return (
                                        <li key={t.id} className="flex items-center gap-1 px-1">
                                            <label htmlFor={`rename-${t.id}`} className="sr-only">Thread name</label>
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
                                            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={commitRename} aria-label="Save name" className={iconButton}>
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
                                                    Delete?
                                                </button>
                                                <button type="button" onClick={() => setConfirmDeleteId(null)} aria-label="Cancel delete" className={iconButton}>
                                                    <X className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                            </>
                                        ) : (
                                            // Always visible on touch screens; on desktop they appear on hover or keyboard focus.
                                            <span className="flex lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 transition-opacity">
                                                <button type="button" onClick={() => startRename(t)} aria-label={`Rename “${t.title}”`} className={iconButton}>
                                                    <Pencil className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                                <button type="button" onClick={() => setConfirmDeleteId(t.id)} aria-label={`Delete “${t.title}”`} className={iconButton}>
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

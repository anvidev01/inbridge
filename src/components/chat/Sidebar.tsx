'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
    Baby, BookOpen, Briefcase, GraduationCap, HeartPulse, House, LogOut, MessageSquareWarning,
    SquarePen, Sprout, UserRound, Users, X,
} from 'lucide-react';
import { ThreadList } from './ThreadList';
import type { Thread } from '@/lib/history';

/** Task / life-event starters. Each fills the composer; nothing is sent until the user presses Send. */
const STARTERS = [
    { label: 'Support for farmers', icon: Sprout, query: 'What central government support is available for small and marginal farmers, and how do I apply?' },
    { label: 'Scholarships for students', icon: GraduationCap, query: 'Which scholarships can a college student apply for on the National Scholarship Portal?' },
    { label: 'Pregnancy and a new baby', icon: Baby, query: 'What government schemes support pregnant women and new mothers?' },
    { label: 'Health cover', icon: HeartPulse, query: 'How do I check if my family is covered under Ayushman Bharat PM-JAY?' },
    { label: 'Starting a business', icon: Briefcase, query: 'What government loan schemes help someone start a small business?' },
    { label: 'Finding work or training', icon: Users, query: 'What government schemes help with skill training and finding a job?' },
    { label: 'A home of your own', icon: House, query: 'How do I apply for a house under Pradhan Mantri Awas Yojana?' },
    { label: 'Pension in old age', icon: UserRound, query: 'What pension schemes are available for senior citizens, and how do I apply?' },
] as const;

const DESKTOP_QUERY = '(min-width: 1024px)';

function subscribeDesktop(onChange: () => void) {
    const mql = window.matchMedia(DESKTOP_QUERY);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
}

/** True at the lg breakpoint, where the sidebar is static instead of a drawer. */
export function useIsDesktop(): boolean {
    return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP_QUERY).matches, () => true);
}

/** React 19 supports `inert`, but the installed @types/react (18) does not declare it. */
export function inertProps(on: boolean): React.HTMLAttributes<HTMLElement> {
    return (on ? { inert: true } : {}) as unknown as React.HTMLAttributes<HTMLElement>;
}

const row = 'w-full flex items-center gap-3 min-h-11 px-3 rounded-lg text-sm text-left transition-colors';

interface SidebarProps {
    id: string;
    isOpen: boolean;
    onClose: () => void;
    threads: Thread[];
    currentThreadId: string | null;
    onSelectThread: (thread: Thread) => void;
    onRenameThread: (id: string, title: string) => void;
    onDeleteThread: (id: string) => void;
    onClearThreads: () => void;
    onNewThread: () => void;
    onStarter: (query: string) => void;
    onDraftComplaint: () => void;
    /** Hidden entirely unless NEXT_PUBLIC_AUTH_ENABLED === 'true'. */
    authEnabled: boolean;
    user: string | null;
    onOpenLogin: () => void;
    onLogout: () => void;
}

export function Sidebar({
    id, isOpen, onClose, threads, currentThreadId, onSelectThread, onRenameThread, onDeleteThread,
    onClearThreads, onNewThread, onStarter, onDraftComplaint, authEnabled, user, onOpenLogin, onLogout,
}: SidebarProps) {
    const isDesktop = useIsDesktop();
    const closeRef = useRef<HTMLButtonElement>(null);
    const drawerOpen = isOpen && !isDesktop;

    // Drawer: move focus in on open, close on Escape. Focus return is handled by the opener.
    useEffect(() => {
        if (!drawerOpen) return;
        closeRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [drawerOpen, onClose]);

    // Close first, so an action that moves focus (e.g. into the composer) wins over
    // the drawer's focus-return to the menu button.
    const thenClose = (fn: () => void) => () => { onClose(); fn(); };

    return (
        <>
            {drawerOpen && (
                <div className="fixed inset-0 z-20 bg-black/60" onClick={onClose} aria-hidden="true" />
            )}

            <aside
                id={id}
                aria-label="InBridge menu"
                {...inertProps(!isOpen && !isDesktop)}
                className={`fixed lg:static inset-y-0 left-0 z-30 w-72 max-w-[85vw] bg-surface border-r border-line flex flex-col h-full transition-transform duration-200 ease-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            >
                <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                    <Image src="/logo.png" alt="" width={32} height={32} className="w-8 h-8 mt-0.5 rounded border border-line shrink-0" />
                    <div className="flex-1 min-w-0">
                        <span className="block text-xl font-bold font-serif tracking-tight text-fg leading-tight">InBridge</span>
                        <span className="block text-xs text-muted leading-snug mt-0.5">Independent guide to government schemes</span>
                    </div>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Close menu"
                        className="lg:hidden -mr-2 -mt-1 inline-flex items-center justify-center w-11 h-11 rounded-full text-muted hover:text-fg hover:bg-surface-2"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-4 flex flex-col gap-5">
                    <nav aria-label="Actions">
                        <ul className="space-y-0.5">
                            <li>
                                <button type="button" onClick={thenClose(onNewThread)} aria-keyshortcuts="Control+Shift+O Meta+Shift+O" className={`${row} text-fg font-medium hover:bg-surface-2`}>
                                    <SquarePen className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
                                    <span className="flex-1">New thread</span>
                                    <kbd className="hidden lg:inline text-xs text-muted font-sans" aria-hidden="true">Ctrl/⌘ ⇧ O</kbd>
                                </button>
                            </li>
                            <li>
                                <Link href="/services" className={`${row} text-fg hover:bg-surface-2`}>
                                    <BookOpen className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
                                    Browse schemes
                                </Link>
                            </li>
                            <li>
                                <button type="button" onClick={thenClose(onDraftComplaint)} className={`${row} text-fg hover:bg-surface-2`}>
                                    <MessageSquareWarning className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
                                    Draft a complaint
                                </button>
                            </li>
                        </ul>
                    </nav>

                    <section aria-labelledby="starters-heading">
                        <h2 id="starters-heading" className="px-3 mb-1 text-xs font-semibold text-muted uppercase tracking-wider">Start with</h2>
                        <ul className="space-y-0.5">
                            {STARTERS.map(({ label, icon: Icon, query }) => (
                                <li key={label}>
                                    <button type="button" onClick={thenClose(() => onStarter(query))} className={`${row} text-muted hover:text-fg hover:bg-surface-2`}>
                                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                                        {label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <div className="pt-4 border-t border-line">
                        <ThreadList
                            threads={threads}
                            currentId={currentThreadId}
                            onSelect={(t) => { onSelectThread(t); onClose(); }}
                            onRename={onRenameThread}
                            onDelete={onDeleteThread}
                            onClearAll={onClearThreads}
                        />
                    </div>
                </div>

                {authEnabled && (
                    user ? (
                        <div className="m-3 p-3 rounded-lg border border-line bg-bg flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-fg text-bg flex items-center justify-center text-xs font-bold shrink-0" aria-hidden="true">
                                {user.substring(0, 2).toUpperCase()}
                            </span>
                            <span className="flex-1 min-w-0 text-sm font-medium text-fg truncate">{user}</span>
                            <button
                                type="button"
                                onClick={onLogout}
                                aria-label="Sign out"
                                title="Sign out"
                                className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-muted hover:text-fg hover:bg-surface-2"
                            >
                                <LogOut className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </div>
                    ) : (
                        <div className="p-3">
                            <button
                                type="button"
                                onClick={onOpenLogin}
                                className="w-full min-h-11 px-4 rounded-lg border border-line text-sm font-semibold text-fg hover:bg-surface-2 transition-colors"
                            >
                                Log in or sign up
                            </button>
                        </div>
                    )
                )}
            </aside>
        </>
    );
}

'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
    Baby, BookOpen, Briefcase, GraduationCap, HeartPulse, House, LogOut, MessageSquareWarning,
    SquarePen, Sprout, UserRound, Users, X, type LucideIcon,
} from 'lucide-react';
import { ThreadList } from './ThreadList';
import type { Thread } from '@/lib/history';
import type { Language } from '@/lib/chat/protocol';

type StarterKey = 'farmers' | 'students' | 'baby' | 'health' | 'business' | 'work' | 'home' | 'pension';

const STARTER_ICONS: { key: StarterKey; icon: LucideIcon }[] = [
    { key: 'farmers', icon: Sprout },
    { key: 'students', icon: GraduationCap },
    { key: 'baby', icon: Baby },
    { key: 'health', icon: HeartPulse },
    { key: 'business', icon: Briefcase },
    { key: 'work', icon: Users },
    { key: 'home', icon: House },
    { key: 'pension', icon: UserRound },
];

interface SidebarCopy {
    menu: string;
    tagline: string;
    closeMenu: string;
    actions: string;
    newThread: string;
    browse: string;
    complaint: string;
    startWith: string;
    /** Task / life-event starters. Each fills the composer; nothing is sent until the user presses Send. */
    starters: Record<StarterKey, { label: string; query: string }>;
    signOut: string;
    logIn: string;
}

export const SIDEBAR_COPY: Record<Language, SidebarCopy> = {
    en: {
        menu: 'InBridge menu',
        tagline: 'Independent guide to government schemes',
        closeMenu: 'Close menu',
        actions: 'Actions',
        newThread: 'New thread',
        browse: 'Browse schemes',
        complaint: 'Draft a complaint',
        startWith: 'Start with',
        starters: {
            farmers: { label: 'Support for farmers', query: 'What central government support is available for small and marginal farmers, and how do I apply?' },
            students: { label: 'Scholarships for students', query: 'Which scholarships can a college student apply for on the National Scholarship Portal?' },
            baby: { label: 'Pregnancy and a new baby', query: 'What government schemes support pregnant women and new mothers?' },
            health: { label: 'Health cover', query: 'How do I check if my family is covered under Ayushman Bharat PM-JAY?' },
            business: { label: 'Starting a business', query: 'What government loan schemes help someone start a small business?' },
            work: { label: 'Finding work or training', query: 'What government schemes help with skill training and finding a job?' },
            home: { label: 'A home of your own', query: 'How do I apply for a house under Pradhan Mantri Awas Yojana?' },
            pension: { label: 'Pension in old age', query: 'What pension schemes are available for senior citizens, and how do I apply?' },
        },
        signOut: 'Sign out',
        logIn: 'Log in or sign up',
    },
    hi: {
        menu: 'InBridge मेन्यू',
        tagline: 'सरकारी योजनाओं की स्वतंत्र जानकारी',
        closeMenu: 'मेन्यू बंद करें',
        actions: 'विकल्प',
        newThread: 'नई बातचीत',
        browse: 'योजनाएँ देखें',
        complaint: 'शिकायत लिखें',
        startWith: 'यहाँ से शुरू करें',
        starters: {
            farmers: { label: 'किसानों के लिए मदद', query: 'छोटे और सीमांत किसानों के लिए केंद्र सरकार की कौन-सी मदद मिलती है, और आवेदन कैसे करें?' },
            students: { label: 'छात्रों के लिए छात्रवृत्ति', query: 'कॉलेज का छात्र राष्ट्रीय छात्रवृत्ति पोर्टल पर कौन-सी छात्रवृत्ति के लिए आवेदन कर सकता है?' },
            baby: { label: 'गर्भावस्था और नवजात शिशु', query: 'गर्भवती महिलाओं और नई माँओं के लिए कौन-सी सरकारी योजनाएँ हैं?' },
            health: { label: 'इलाज का बीमा', query: 'कैसे देखूँ कि मेरा परिवार आयुष्मान भारत PM-JAY में शामिल है या नहीं?' },
            business: { label: 'अपना काम शुरू करना', query: 'छोटा व्यापार शुरू करने के लिए कौन-सी सरकारी लोन योजनाएँ हैं?' },
            work: { label: 'नौकरी या ट्रेनिंग', query: 'हुनर की ट्रेनिंग और नौकरी ढूँढने में कौन-सी सरकारी योजनाएँ मदद करती हैं?' },
            home: { label: 'अपना घर', query: 'प्रधानमंत्री आवास योजना में घर के लिए आवेदन कैसे करें?' },
            pension: { label: 'बुढ़ापे में पेंशन', query: 'बुज़ुर्गों के लिए कौन-सी पेंशन योजनाएँ हैं, और आवेदन कैसे करें?' },
        },
        signOut: 'साइन आउट',
        logIn: 'लॉग इन या साइन अप',
    },
    hinglish: {
        menu: 'InBridge menu',
        tagline: 'Sarkari schemes ki independent guide',
        closeMenu: 'Menu band karein',
        actions: 'Actions',
        newThread: 'Naya thread',
        browse: 'Schemes dekhein',
        complaint: 'Complaint likhein',
        startWith: 'Yahan se shuru karein',
        starters: {
            farmers: { label: 'Kisaanon ke liye madad', query: 'Chhote aur marginal kisaanon ke liye central government ki kya madad milti hai, aur apply kaise karein?' },
            students: { label: 'Students ke liye scholarship', query: 'College student National Scholarship Portal par kaunsi scholarships ke liye apply kar sakta hai?' },
            baby: { label: 'Pregnancy aur naya baby', query: 'Pregnant mahilaon aur nayi maaon ke liye kaunsi sarkari schemes hain?' },
            health: { label: 'Health cover', query: 'Kaise check karein ki meri family Ayushman Bharat PM-JAY mein covered hai?' },
            business: { label: 'Business shuru karna', query: 'Chhota business shuru karne ke liye kaunsi sarkari loan schemes hain?' },
            work: { label: 'Naukri ya training', query: 'Skill training aur naukri dhoondhne mein kaunsi sarkari schemes madad karti hain?' },
            home: { label: 'Apna ghar', query: 'Pradhan Mantri Awas Yojana mein ghar ke liye apply kaise karein?' },
            pension: { label: 'Budhape mein pension', query: 'Senior citizens ke liye kaunsi pension schemes hain, aur apply kaise karein?' },
        },
        signOut: 'Sign out',
        logIn: 'Log in ya sign up',
    },
};

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
    language: Language;
    /** The last save to this device failed; ThreadList shows a note. */
    saveFailed: boolean;
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
    id, language, saveFailed, isOpen, onClose, threads, currentThreadId, onSelectThread, onRenameThread, onDeleteThread,
    onClearThreads, onNewThread, onStarter, onDraftComplaint, authEnabled, user, onOpenLogin, onLogout,
}: SidebarProps) {
    const copy = SIDEBAR_COPY[language];
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
                aria-label={copy.menu}
                {...inertProps(!isOpen && !isDesktop)}
                className={`fixed lg:static inset-y-0 left-0 z-30 w-72 max-w-[85vw] bg-surface border-r border-line flex flex-col h-full transition-transform duration-200 ease-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            >
                <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0 px-1">
                        <Link href="/" className="block w-fit text-xl font-bold font-serif tracking-tight text-fg leading-tight hover:text-accent transition-colors">InBridge</Link>
                        <span className="block text-xs text-muted leading-snug mt-0.5">{copy.tagline}</span>
                    </div>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        aria-label={copy.closeMenu}
                        className="lg:hidden -mr-2 -mt-1 inline-flex items-center justify-center w-11 h-11 rounded-full text-muted hover:text-fg hover:bg-surface-2"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-4 flex flex-col gap-5">
                    <nav aria-label={copy.actions}>
                        <ul className="space-y-0.5">
                            <li>
                                <button type="button" onClick={thenClose(onNewThread)} aria-keyshortcuts="Control+Shift+O Meta+Shift+O" className={`${row} text-fg font-medium hover:bg-surface-2`}>
                                    <SquarePen className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
                                    <span className="flex-1">{copy.newThread}</span>
                                    <kbd className="hidden lg:inline text-xs text-muted font-sans" aria-hidden="true">Ctrl/⌘ ⇧ O</kbd>
                                </button>
                            </li>
                            <li>
                                <Link href="/services" className={`${row} text-fg hover:bg-surface-2`}>
                                    <BookOpen className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
                                    {copy.browse}
                                </Link>
                            </li>
                            <li>
                                <button type="button" onClick={thenClose(onDraftComplaint)} className={`${row} text-fg hover:bg-surface-2`}>
                                    <MessageSquareWarning className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
                                    {copy.complaint}
                                </button>
                            </li>
                        </ul>
                    </nav>

                    <section aria-labelledby="starters-heading">
                        <h2 id="starters-heading" className="px-3 mb-1 text-xs font-semibold text-muted uppercase tracking-wider">{copy.startWith}</h2>
                        <ul className="space-y-0.5">
                            {STARTER_ICONS.map(({ key, icon: Icon }) => (
                                <li key={key}>
                                    <button type="button" onClick={thenClose(() => onStarter(copy.starters[key].query))} className={`${row} text-muted hover:text-fg hover:bg-surface-2`}>
                                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                                        {copy.starters[key].label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <div className="pt-4 border-t border-line">
                        <ThreadList
                            language={language}
                            saveFailed={saveFailed}
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
                                aria-label={copy.signOut}
                                title={copy.signOut}
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
                                {copy.logIn}
                            </button>
                        </div>
                    )
                )}
            </aside>
        </>
    );
}

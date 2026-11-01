'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Menu, SquarePen } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ChatWindow } from './ChatWindow';
import { ChatInput } from './ChatInput';
import { Sidebar, inertProps, useIsDesktop } from './Sidebar';
import { LoginModal } from './LoginModal';
import { ErrorCard, needsEdit, parseChatError } from './ErrorCard';
import { LanguageSelect, useLanguagePreference } from './LanguageSelect';
import { Onboarding } from './Onboarding';
import {
    LANGUAGES, isChatMode, messageText,
    type ChatMode, type ChatRequestExtras, type Focus, type InBridgeUIMessage, type Language, type PhaseData,
} from '@/lib/chat/protocol';
import {
    clearStoredThreads, deleteStoredThread, getServerThreadsSnapshot, getThreadsSnapshot, newThreadId,
    renameStoredThread, saveThread, subscribeThreads, type Thread,
} from '@/lib/history';

/** Auth is hidden unless explicitly enabled; the backend's data stores are not reliably up. */
const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
const SIDEBAR_ID = 'inbridge-sidebar';
const MAX_PREFILL = 500;

const COPY: Record<Language, {
    heading: string;
    sub: string;
    headingGrievance: string;
    subGrievance: string;
    newThread: string;
    openMenu: string;
    starters: { title: string; query: string }[];
    status: { busy: string; ready: string; error: string };
}> = {
    en: {
        heading: 'Ask about government schemes and services',
        sub: 'In English, हिन्दी or Hinglish, with links to official sources where available.',
        headingGrievance: 'Draft a complaint',
        subGrievance: 'Describe what went wrong. InBridge helps you write a clear complaint that you can file yourself on pgportal.gov.in.',
        newThread: 'New thread',
        openMenu: 'Open menu',
        starters: [
            { title: 'PM-KISAN installment', query: 'How do I check the status of my PM-KISAN installment?' },
            { title: 'Scholarship on NSP', query: 'How do I apply for a scholarship on the National Scholarship Portal?' },
            { title: 'Aadhaar address update', query: 'How do I update the address on my Aadhaar card online?' },
            { title: 'Ayushman card', query: 'How do I get an Ayushman card and check if my family is eligible?' },
        ],
        status: { busy: 'InBridge is preparing an answer.', ready: 'Answer ready.', error: 'The answer could not be completed.' },
    },
    hi: {
        heading: 'सरकारी योजनाओं और सेवाओं के बारे में पूछें',
        sub: 'English, हिन्दी या Hinglish में — जहाँ उपलब्ध हों, आधिकारिक स्रोतों के लिंक के साथ।',
        headingGrievance: 'शिकायत लिखें',
        subGrievance: 'बताइए क्या गलत हुआ। InBridge एक साफ़ शिकायत लिखने में मदद करता है, जिसे आप खुद pgportal.gov.in पर दर्ज कर सकते हैं।',
        newThread: 'नई बातचीत',
        openMenu: 'मेन्यू खोलें',
        starters: [
            { title: 'PM-KISAN किस्त', query: 'मैं अपनी PM-KISAN किस्त का स्टेटस कैसे देखूँ?' },
            { title: 'NSP पर छात्रवृत्ति', query: 'राष्ट्रीय छात्रवृत्ति पोर्टल (NSP) पर छात्रवृत्ति के लिए आवेदन कैसे करें?' },
            { title: 'आधार में पता बदलना', query: 'आधार कार्ड में पता ऑनलाइन कैसे बदलें?' },
            { title: 'आयुष्मान कार्ड', query: 'आयुष्मान कार्ड कैसे बनवाएँ और कैसे जाँचें कि मेरा परिवार पात्र है या नहीं?' },
        ],
        status: { busy: 'InBridge उत्तर तैयार कर रहा है।', ready: 'उत्तर तैयार है।', error: 'उत्तर पूरा नहीं हो सका।' },
    },
    hinglish: {
        heading: 'Sarkari schemes aur services ke baare mein poochhein',
        sub: 'English, हिन्दी ya Hinglish mein — jahan available ho, official sources ke links ke saath.',
        headingGrievance: 'Complaint likhein',
        subGrievance: 'Bataiye kya galat hua. InBridge ek saaf complaint likhne mein madad karta hai, jise aap khud pgportal.gov.in par file kar sakte hain.',
        newThread: 'Naya thread',
        openMenu: 'Menu kholein',
        starters: [
            { title: 'PM-KISAN installment', query: 'PM-KISAN installment ka status kaise check karein?' },
            { title: 'NSP par scholarship', query: 'National Scholarship Portal par scholarship ke liye apply kaise karein?' },
            { title: 'Aadhaar address update', query: 'Aadhaar card mein address online kaise update karein?' },
            { title: 'Ayushman card', query: 'Ayushman card kaise banwayein aur kaise check karein ki meri family eligible hai?' },
        ],
        status: { busy: 'InBridge answer taiyaar kar raha hai.', ready: 'Answer taiyaar hai.', error: 'Answer poora nahi ho saka.' },
    },
};

/** One useChat session per thread; changing `id` gives useChat a fresh, isolated Chat instance. */
interface Session {
    id: string;
    initial: InBridgeUIMessage[];
}

interface ChatShellProps {
    /** From ?q= : fills the composer, never auto-sends. */
    initialQuery?: string;
    /** From ?mode=grievance */
    initialMode?: ChatMode;
}

export function ChatShell({ initialQuery = '', initialMode = 'default' }: ChatShellProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [user, setUser] = useState<string | null>(null);
    const [loginOpen, setLoginOpen] = useState(false);
    const [input, setInput] = useState(initialQuery.slice(0, MAX_PREFILL));
    const [language, setLanguage] = useLanguagePreference();
    const [mode, setMode] = useState<ChatMode>(initialMode);
    const [focus, setFocus] = useState<Focus>('all');
    const [phase, setPhase] = useState<PhaseData | null>(null);
    const [session, setSession] = useState<Session>(() => ({ id: newThreadId(), initial: [] }));

    const threads = useSyncExternalStore(subscribeThreads, getThreadsSnapshot, getServerThreadsSnapshot);
    const isDesktop = useIsDesktop();
    const copy = COPY[language];

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);

    // Thread the in-flight request belongs to; null means "ignore its onFinish/onData"
    // (set when the user leaves a thread mid-answer).
    const requestThreadRef = useRef<string | null>(null);

    const [transport] = useState(() => new DefaultChatTransport<InBridgeUIMessage>({ api: '/api/chat' }));

    // {language, mode, focus} go in each request's body (merged by the transport),
    // built from current state at call time: never stale, and changing them never
    // remounts or resets the chat. Every send/regenerate goes through this.
    const extras = useMemo<ChatRequestExtras>(() => ({ language, mode, focus }), [language, mode, focus]);

    const { messages, sendMessage, regenerate, stop, status, error, clearError, setMessages } = useChat<InBridgeUIMessage>({
        id: session.id,
        messages: session.initial,
        transport,
        onData: (part) => {
            if (part.type === 'data-phase' && requestThreadRef.current) setPhase(part.data);
        },
        onError: (err) => {
            setPhase(null);
            // The message itself was rejected: take it back into the composer so it can be edited.
            if (needsEdit(parseChatError(err).kind)) {
                setMessages((prev) => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.role !== 'user') return prev;
                    const text = messageText(lastMsg);
                    setInput((current) => current.trim() ? current : text);
                    return prev.slice(0, -1);
                });
            }
        },
        onFinish: ({ messages: finished }) => {
            setPhase(null);
            const threadId = requestThreadRef.current;
            requestThreadRef.current = null;
            if (threadId && finished.length > 0) saveThread(threadId, finished);
        },
    });

    const busy = status === 'submitted' || status === 'streaming';
    const empty = messages.length === 0;

    // <html lang> follows the answer language.
    useEffect(() => {
        document.documentElement.lang = LANGUAGES.find((l) => l.code === language)?.htmlLang ?? 'en-IN';
    }, [language]);

    // Restore a previous login (only when auth is enabled).
    useEffect(() => {
        if (!AUTH_ENABLED) return;
        try {
            const stored = localStorage.getItem('inbridge_user');
            // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a stored login after mount
            if (stored) setUser(JSON.parse(stored).name ?? null);
        } catch {
            localStorage.removeItem('inbridge_user');
            localStorage.removeItem('inbridge_token');
        }
    }, []);

    const focusComposer = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
    }, []);

    /** Leave the current thread. A partial answer is saved before its stream is stopped. */
    const leaveThread = useCallback(() => {
        if (busy) {
            const threadId = requestThreadRef.current;
            requestThreadRef.current = null;
            if (threadId && messages.length > 0) saveThread(threadId, messages);
            void stop();
        }
        setPhase(null);
        clearError();
    }, [busy, messages, stop, clearError]);

    const startNewThread = useCallback(() => {
        leaveThread();
        setSession({ id: newThreadId(), initial: [] });
        setMode('default');
        // The draft in the composer is kept on purpose.
        requestAnimationFrame(focusComposer);
    }, [leaveThread, focusComposer]);

    const openThread = useCallback((thread: Thread) => {
        if (thread.id === session.id) return;
        leaveThread();
        setSession({ id: thread.id, initial: thread.messages });
    }, [leaveThread, session.id]);

    const handleDeleteThread = useCallback((id: string) => {
        deleteStoredThread(id);
        if (id === session.id) startNewThread();
    }, [session.id, startNewThread]);

    const handleClearThreads = useCallback(() => {
        clearStoredThreads();
        startNewThread();
    }, [startNewThread]);

    const send = useCallback((text: string) => {
        const trimmed = text.trim();
        if (!trimmed || busy) return;
        requestThreadRef.current = session.id;
        setPhase(null);
        setInput('');
        void sendMessage({ text: trimmed }, { body: extras });
    }, [busy, session.id, sendMessage, extras]);

    const handleRegenerate = useCallback(() => {
        if (busy) return;
        requestThreadRef.current = session.id;
        setPhase(null);
        void regenerate({ body: extras });
    }, [busy, session.id, regenerate, extras]);

    const fillComposer = useCallback((query: string) => {
        setInput(query);
        requestAnimationFrame(focusComposer);
    }, [focusComposer]);

    const draftComplaint = useCallback(() => {
        setMode('grievance');
        requestAnimationFrame(focusComposer);
    }, [focusComposer]);

    const closeSidebar = useCallback(() => {
        setSidebarOpen(false);
        // Return focus to the control that opened the drawer.
        if (!window.matchMedia('(min-width: 1024px)').matches) requestAnimationFrame(() => menuButtonRef.current?.focus());
    }, []);

    // Global keys: Esc stops an answer, Ctrl/Cmd+Shift+O starts a new thread.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                startNewThread();
                return;
            }
            if (e.key === 'Escape' && busy && !e.defaultPrevented && !sidebarOpen && !loginOpen) {
                void stop();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [busy, sidebarOpen, loginOpen, startNewThread, stop]);

    // One polite announcement per state change, instead of a live region on the whole log.
    let statusText = '';
    if (busy) statusText = copy.status.busy;
    else if (status === 'error') statusText = copy.status.error;
    else if (!empty && messages[messages.length - 1].role === 'assistant') statusText = copy.status.ready;

    const drawerOpenOnMobile = sidebarOpen && !isDesktop;

    return (
        <div className="flex h-dvh w-full bg-bg text-fg overflow-hidden">
            <Sidebar
                id={SIDEBAR_ID}
                isOpen={sidebarOpen}
                onClose={closeSidebar}
                threads={threads}
                currentThreadId={session.id}
                onSelectThread={openThread}
                onRenameThread={renameStoredThread}
                onDeleteThread={handleDeleteThread}
                onClearThreads={handleClearThreads}
                onNewThread={startNewThread}
                onStarter={fillComposer}
                onDraftComplaint={draftComplaint}
                authEnabled={AUTH_ENABLED}
                user={user}
                onOpenLogin={() => setLoginOpen(true)}
                onLogout={() => {
                    setUser(null);
                    localStorage.removeItem('inbridge_user');
                    localStorage.removeItem('inbridge_token');
                }}
            />

            {AUTH_ENABLED && (
                <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} onLogin={setUser} />
            )}

            {/* Inert while the mobile drawer is open: keeps focus inside the drawer. */}
            <div className="flex-1 flex flex-col min-w-0 h-full" {...inertProps(drawerOpenOnMobile)}>
                <header className="flex items-center gap-1 sm:gap-2 px-2 sm:px-6 h-16 shrink-0">
                    <button
                        ref={menuButtonRef}
                        type="button"
                        onClick={() => setSidebarOpen(true)}
                        aria-label={copy.openMenu}
                        aria-expanded={sidebarOpen}
                        aria-controls={SIDEBAR_ID}
                        className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-full text-muted hover:text-fg hover:bg-surface-2"
                    >
                        <Menu className="w-6 h-6" aria-hidden="true" />
                    </button>
                    <span className="lg:hidden max-[359px]:hidden text-xl font-bold font-serif tracking-tight">InBridge</span>

                    <div className="ml-auto flex items-center gap-1 sm:gap-2">
                        <LanguageSelect value={language} onChange={setLanguage} />
                        <ThemeToggle />
                        <button
                            type="button"
                            onClick={startNewThread}
                            aria-keyshortcuts="Control+Shift+O Meta+Shift+O"
                            className="inline-flex items-center justify-center gap-2 min-w-11 h-11 px-3 rounded-full bg-fg text-bg text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                            <SquarePen className="w-4 h-4" aria-hidden="true" />
                            <span className="sr-only sm:not-sr-only">{copy.newThread}</span>
                        </button>
                    </div>
                </header>

                {/* The composer block stays at the same tree position in both states, so it never remounts. */}
                <div className={`flex-1 min-h-0 flex flex-col ${empty ? 'overflow-y-auto px-4' : ''}`}>
                    {empty ? (
                        <div className="mt-auto w-full max-w-3xl mx-auto pt-6 pb-6 text-center">
                            <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-fg text-balance">
                                {mode === 'grievance' ? copy.headingGrievance : copy.heading}
                            </h1>
                            <p className="mt-3 text-base text-muted text-balance">
                                {mode === 'grievance' ? copy.subGrievance : copy.sub}
                            </p>
                        </div>
                    ) : (
                        <ChatWindow
                            messages={messages}
                            status={status}
                            phase={phase}
                            language={language}
                            mode={mode}
                            onFollowUp={send}
                            onRegenerate={handleRegenerate}
                        />
                    )}

                    <div className={empty
                        ? 'w-full max-w-3xl mx-auto'
                        : 'w-full shrink-0 border-t border-line px-4 md:px-8 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'}>
                        <div className={`${empty ? '' : 'max-w-3xl mx-auto'} flex flex-col gap-3`}>
                            {error && (
                                <ErrorCard
                                    error={error}
                                    language={language}
                                    onRetry={handleRegenerate}
                                    onDismiss={clearError}
                                />
                            )}
                            <ChatInput
                                value={input}
                                onChange={setInput}
                                onSend={send}
                                onStop={() => void stop()}
                                busy={busy}
                                language={language}
                                focus={focus}
                                onFocusChange={setFocus}
                                mode={mode}
                                onModeChange={setMode}
                                textareaRef={textareaRef}
                            />
                        </div>
                    </div>

                    {empty && (
                        <div className="mb-auto w-full max-w-3xl mx-auto pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4">
                            {mode === 'default' && (
                                <ul className="grid gap-3 sm:grid-cols-2">
                                    {copy.starters.map((s) => (
                                        <li key={s.title}>
                                            <button
                                                type="button"
                                                onClick={() => fillComposer(s.query)}
                                                className="w-full h-full min-h-11 text-left rounded-lg border border-line bg-surface p-4 hover:bg-surface-2 transition-colors"
                                            >
                                                <span className="block text-sm font-semibold text-fg">{s.title}</span>
                                                <span className="block mt-1 text-sm text-muted">{s.query}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <Onboarding language={language} />
                        </div>
                    )}
                </div>
            </div>

            <p className="sr-only" role="status" aria-live="polite">{statusText}</p>
        </div>
    );
}

/** ChatShell seeded from ?q= and ?mode=. Must be rendered inside <Suspense> (useSearchParams). */
export function ChatShellFromSearchParams() {
    const params = useSearchParams();
    const mode = params.get('mode');
    return (
        <ChatShell
            initialQuery={params.get('q') ?? ''}
            initialMode={isChatMode(mode) ? mode : 'default'}
        />
    );
}

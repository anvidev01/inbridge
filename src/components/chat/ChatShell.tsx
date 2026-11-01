'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Menu, SquarePen } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LogoMark } from '@/components/site/Logo';
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

interface StatusCopy { busy: string; ready: string; stopped: string }

/** How the last request made in this session ended, for the sr-only status line. */

/**
 * Display only: a non-breaking hyphen keeps scheme names like PM-KISAN and
 * PM-JAY on one line at 390px. The query sent to the model keeps the plain hyphen.
 */
function keepNamesWhole(text: string): string {
    return text.replace(/\b(PM|NSP)-(?=[A-Z])/g, '$1\u2011');
}

export type Outcome = 'none' | 'ready' | 'stopped';

/**
 * Errors are 'none': ErrorCard's role="alert" already announces them, so the
 * status line stays quiet instead of reading the failure twice.
 */
export function outcomeOfFinish(finish: { isAbort: boolean; isError: boolean; isDisconnect: boolean }): Outcome {
    if (finish.isError || finish.isDisconnect) return 'none';
    if (finish.isAbort) return 'stopped';
    return 'ready';
}

/** The polite status line: busy while a request runs, then the outcome of that request only. */
export function statusAnnouncement(copy: StatusCopy, busy: boolean, outcome: Outcome): string {
    if (busy) return copy.busy;
    if (outcome === 'ready') return copy.ready;
    if (outcome === 'stopped') return copy.stopped;
    return '';
}

/**
 * Which thread (if any) to save when leaving it. Only an in-flight request's
 * thread is saved, and only when saving was not opted out of (delete / clear).
 */
export function threadToSaveOnLeave(requestThreadId: string | null, busy: boolean, messageCount: number, save: boolean): string | null {
    if (!save || !busy || !requestThreadId || messageCount === 0) return null;
    return requestThreadId;
}

const COPY: Record<Language, {
    heading: string;
    sub: string;
    headingGrievance: string;
    subGrievance: string;
    newThread: string;
    openMenu: string;
    startersHeading: string;
    /** Suggested questions. `context` is a short plain line naming the scheme or portal. */
    starters: { context: string; query: string }[];
    status: StatusCopy;
}> = {
    en: {
        heading: 'Ask about government schemes and services',
        sub: 'In English, हिन्दी or Hinglish, with links to official sources where available.',
        headingGrievance: 'Draft a complaint',
        subGrievance: 'Describe what went wrong. InBridge helps you write a clear complaint that you can file yourself on pgportal.gov.in.',
        newThread: 'New thread',
        openMenu: 'Open menu',
        startersHeading: 'Try asking',
        starters: [
            { context: 'PM-KISAN, income support for farmers', query: 'How do I check the status of my PM-KISAN installment?' },
            { context: 'National Scholarship Portal (NSP)', query: 'How do I apply for a scholarship on the National Scholarship Portal?' },
            { context: 'Aadhaar, run by UIDAI', query: 'How do I update the address on my Aadhaar card online?' },
            { context: 'Ayushman Bharat PM-JAY, health cover', query: 'How do I get an Ayushman card and check if my family is eligible?' },
        ],
        status: { busy: 'InBridge is preparing an answer.', ready: 'Answer ready.', stopped: 'Answer stopped.' },
    },
    hi: {
        heading: 'सरकारी योजनाओं और सेवाओं के बारे में पूछें',
        sub: 'English, हिन्दी या Hinglish में पूछें। जहाँ उपलब्ध हों, आधिकारिक स्रोतों के लिंक साथ में मिलते हैं।',
        headingGrievance: 'शिकायत लिखें',
        subGrievance: 'बताइए क्या गलत हुआ। InBridge एक साफ़ शिकायत लिखने में मदद करता है, जिसे आप खुद pgportal.gov.in पर दर्ज कर सकते हैं।',
        newThread: 'नई बातचीत',
        openMenu: 'मेन्यू खोलें',
        startersHeading: 'ये पूछकर देखें',
        starters: [
            { context: 'PM-KISAN, किसानों के लिए आय सहायता', query: 'मैं अपनी PM-KISAN किस्त का स्टेटस कैसे देखूँ?' },
            { context: 'राष्ट्रीय छात्रवृत्ति पोर्टल (NSP)', query: 'राष्ट्रीय छात्रवृत्ति पोर्टल (NSP) पर छात्रवृत्ति के लिए आवेदन कैसे करें?' },
            { context: 'आधार, UIDAI द्वारा', query: 'आधार कार्ड में पता ऑनलाइन कैसे बदलें?' },
            { context: 'आयुष्मान भारत PM-JAY, इलाज का बीमा', query: 'आयुष्मान कार्ड कैसे बनवाएँ और कैसे जाँचें कि मेरा परिवार पात्र है या नहीं?' },
        ],
        status: { busy: 'InBridge उत्तर तैयार कर रहा है।', ready: 'उत्तर तैयार है।', stopped: 'उत्तर रोक दिया गया।' },
    },
    hinglish: {
        heading: 'Sarkari schemes aur services par poochhein',
        sub: 'English, हिन्दी ya Hinglish mein, jahan available ho official sources ke links ke saath.',
        headingGrievance: 'Complaint likhein',
        subGrievance: 'Bataiye kya galat hua. InBridge ek saaf complaint likhne mein madad karta hai, jise aap khud pgportal.gov.in par file kar sakte hain.',
        newThread: 'Naya thread',
        openMenu: 'Menu kholein',
        startersHeading: 'Yeh poochh kar dekhein',
        starters: [
            { context: 'PM-KISAN, kisaanon ke liye income support', query: 'PM-KISAN installment ka status kaise check karein?' },
            { context: 'National Scholarship Portal (NSP)', query: 'National Scholarship Portal par scholarship ke liye apply kaise karein?' },
            { context: 'Aadhaar, UIDAI ka', query: 'Aadhaar card mein address online kaise update karein?' },
            { context: 'Ayushman Bharat PM-JAY, health cover', query: 'Ayushman card kaise banwayein aur kaise check karein ki meri family eligible hai?' },
        ],
        status: { busy: 'InBridge answer taiyaar kar raha hai.', ready: 'Answer taiyaar hai.', stopped: 'Answer rok diya gaya.' },
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
    // Retrieval works out the topic from the question itself, so the composer
    // has no topic picker; the server still accepts an optional focus filter.
    const focus: Focus = 'all';
    const [phase, setPhase] = useState<PhaseData | null>(null);
    const [session, setSession] = useState<Session>(() => ({ id: newThreadId(), initial: [] }));
    const [outcome, setOutcome] = useState<Outcome>('none');
    const [saveFailed, setSaveFailed] = useState(false);

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
        onFinish: ({ messages: finished, isAbort, isError, isDisconnect }) => {
            setPhase(null);
            const threadId = requestThreadRef.current;
            requestThreadRef.current = null;
            // null: the user left, deleted or cleared this thread mid-answer. Don't save or announce.
            if (!threadId) return;
            setOutcome(outcomeOfFinish({ isAbort, isError, isDisconnect }));
            if (finished.length > 0) setSaveFailed(!saveThread(threadId, finished));
        },
    });

    const busy = status === 'submitted' || status === 'streaming';
    const empty = messages.length === 0;

    // Latest values for callbacks that must keep a stable identity while tokens stream.
    const messagesRef = useRef(messages);
    const busyRef = useRef(busy);
    useLayoutEffect(() => {
        messagesRef.current = messages;
        busyRef.current = busy;
    });

    // <html lang> follows the answer language; put back what was there when leaving /chat.
    useEffect(() => {
        const root = document.documentElement;
        const previous = root.lang;
        root.lang = LANGUAGES.find((l) => l.code === language)?.htmlLang ?? 'en-IN';
        return () => { root.lang = previous || 'en-IN'; };
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

    /**
     * Leave the current thread. By default a partial answer is saved before its
     * stream is stopped; `save: false` (delete / clear all) stops without saving.
     */
    const leaveThread = useCallback(({ save = true }: { save?: boolean } = {}) => {
        const messagesNow = messagesRef.current;
        const threadId = threadToSaveOnLeave(requestThreadRef.current, busyRef.current, messagesNow.length, save);
        if (busyRef.current) {
            // Detach first, so the aborted request's onFinish neither saves nor announces.
            requestThreadRef.current = null;
            void stop();
        }
        if (threadId) setSaveFailed(!saveThread(threadId, messagesNow));
        setPhase(null);
        setOutcome('none');
        clearError();
    }, [stop, clearError]);

    const startNewThread = useCallback((options?: { save?: boolean }) => {
        leaveThread(options);
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
        // save: false stops a streaming answer without writing the deleted thread back.
        if (id === session.id) startNewThread({ save: false });
    }, [session.id, startNewThread]);

    const handleClearThreads = useCallback(() => {
        clearStoredThreads();
        setSaveFailed(false);
        // Clear all is a privacy control: the in-flight thread must not be re-saved either.
        startNewThread({ save: false });
    }, [startNewThread]);

    const send = useCallback((text: string) => {
        const trimmed = text.trim();
        if (!trimmed || busy) return;
        requestThreadRef.current = session.id;
        setPhase(null);
        setOutcome('none');
        setInput('');
        void sendMessage({ text: trimmed }, { body: extras });
    }, [busy, session.id, sendMessage, extras]);

    const handleRegenerate = useCallback(() => {
        if (busy) return;
        requestThreadRef.current = session.id;
        setPhase(null);
        setOutcome('none');
        void regenerate({ body: extras });
    }, [busy, session.id, regenerate, extras]);

    // Click handlers pass an event; never let it reach startNewThread's options.
    const newThreadButton = useCallback(() => startNewThread(), [startNewThread]);

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
    const statusText = statusAnnouncement(copy.status, busy, outcome);

    const drawerOpenOnMobile = sidebarOpen && !isDesktop;

    return (
        <div className="flex h-dvh w-full bg-bg text-fg overflow-hidden">
            <Sidebar
                id={SIDEBAR_ID}
                isOpen={sidebarOpen}
                onClose={closeSidebar}
                language={language}
                threads={threads}
                saveFailed={saveFailed}
                currentThreadId={session.id}
                onSelectThread={openThread}
                onRenameThread={renameStoredThread}
                onDeleteThread={handleDeleteThread}
                onClearThreads={handleClearThreads}
                onNewThread={newThreadButton}
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
                        className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-full text-muted hover:text-fg hover:bg-surface-2 transition duration-150 motion-safe:active:scale-[0.94] focus-visible:rounded-full!"
                    >
                        <Menu className="w-6 h-6" aria-hidden="true" />
                    </button>
                    <span className="lg:hidden inline-flex items-center gap-2">
                        <LogoMark size={22} className="text-accent" />
                        <span className="max-[359px]:sr-only font-serif text-xl font-semibold leading-none tracking-tight">InBridge</span>
                    </span>

                    <div className="ml-auto flex items-center gap-1 sm:gap-2">
                        <LanguageSelect value={language} onChange={(next) => { setLanguage(next); setOutcome('none'); }} />
                        <ThemeToggle />
                        <button
                            type="button"
                            onClick={newThreadButton}
                            aria-label={copy.newThread}
                            title={copy.newThread}
                            aria-keyshortcuts="Control+Shift+O Meta+Shift+O"
                            className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-line text-muted hover:text-fg hover:bg-surface-2 transition duration-150 motion-safe:active:scale-[0.94] focus-visible:rounded-full!"
                        >
                            <SquarePen className="w-[18px] h-[18px]" aria-hidden="true" />
                        </button>
                    </div>
                </header>

                {/* The composer block stays at the same tree position in both states, so it never remounts. */}
                <div className={`flex-1 min-h-0 flex flex-col ${empty ? 'overflow-y-auto px-4' : ''}`}>
                    {empty ? (
                        <div className="mt-auto w-full max-w-3xl mx-auto pt-6 pb-6 text-center">
                            <h1 className="font-serif text-[1.75rem] sm:text-[2rem] leading-tight font-semibold tracking-tight text-fg text-balance">
                                {mode === 'grievance' ? copy.headingGrievance : copy.heading}
                            </h1>
                            <p className="mt-3 text-base text-muted text-pretty">
                                {mode === 'grievance' ? copy.subGrievance : copy.sub}
                            </p>
                        </div>
                    ) : (
                        <ChatWindow
                            key={session.id}
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
                                mode={mode}
                                onModeChange={setMode}
                                textareaRef={textareaRef}
                            />
                        </div>
                    </div>

                    {empty && (
                        <div className="mb-auto w-full max-w-3xl mx-auto pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4">
                            {mode === 'default' && (
                                <section aria-labelledby="starters-title">
                                    <h2 id="starters-title" className="px-3 mb-1 text-sm font-medium text-muted">{copy.startersHeading}</h2>
                                    <ul className="flex flex-col">
                                        {copy.starters.map((s) => (
                                            <li key={s.query}>
                                                <button
                                                    type="button"
                                                    onClick={() => fillComposer(s.query)}
                                                    className="group w-full min-h-11 flex items-start gap-3 text-left rounded-lg px-3 py-3 hover:bg-surface active:bg-surface-2 transition-colors duration-150"
                                                >
                                                    <span className="flex-1 min-w-0">
                                                        <span className="block text-base leading-snug text-fg">{keepNamesWhole(s.query)}</span>
                                                        <span className="block mt-1 text-sm text-muted">{keepNamesWhole(s.context)}</span>
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
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

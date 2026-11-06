/**
 * Local chat history (F4).
 *
 * Threads live in this browser's localStorage. Without an account there is no
 * server copy, which is what the UI tells the user ("Saved only on this
 * device."). When signed in, src/lib/thread-sync.ts mirrors them to the user's
 * account through the listener below. The pure functions at the top are unit-tested; the store at the
 * bottom wraps them for React's useSyncExternalStore.
 */
import type { InBridgeUIMessage, Language } from './chat/protocol';

export const HISTORY_KEY = 'inbridge_threads_v1';
export const MAX_THREADS = 50;
export const HISTORY_NOTE: Record<Language, string> = {
    en: 'Saved only on this device.',
    hi: 'सिर्फ़ इसी डिवाइस पर सेव होता है।',
    hinglish: 'Sirf isi device par save hota hai.',
};

/** Shown instead of HISTORY_NOTE while signed in. */
export const HISTORY_NOTE_ACCOUNT: Record<Language, string> = {
    en: 'Saved to your account, so you can continue on any device.',
    hi: 'आपके खाते में सेव होता है, इसलिए आप किसी भी डिवाइस पर जारी रख सकते हैं।',
    hinglish: 'Aapke account mein save hota hai, isliye kisi bhi device par jaari rakh sakte hain.',
};
/** Shown while signed in but the account copy could not be updated. */
export const HISTORY_NOTE_SYNC_FAILED: Record<Language, string> = {
    en: 'Saved on this device. Could not reach your account; will retry.',
    hi: 'इस डिवाइस पर सेव है। खाते तक नहीं पहुँच सके; दोबारा कोशिश करेंगे।',
    hinglish: 'Is device par save hai. Account tak nahi pahunch sake; dobara koshish karenge.',
};

/**
 * Per-answer state written by the answer renderer (feedback given, checklist
 * ticks), keyed `<prefix><messageId>`. Clearing history removes these too.
 */
export const ANSWER_STATE_PREFIXES = ['inbridge_feedback:', 'inbridge_checklist:'] as const;
const TITLE_MAX = 60;
/** Stored title for threads with no text; ThreadList localises it at render time. */
export const DEFAULT_TITLE = 'New thread';

export interface Thread {
    id: string;
    title: string;
    /** Epoch ms. */
    createdAt: number;
    /** Epoch ms; threads are listed newest first by this. */
    updatedAt: number;
    messages: InBridgeUIMessage[];
}

/** The subset of the Web Storage API we use, so tests can pass a fake. */
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

/** Storage that can also list its keys (window.localStorage does). */
export interface KeyedStorageLike extends StorageLike {
    readonly length: number;
    key(index: number): string | null;
}

// ── Pure helpers ──────────────────────────────────────────────────────────

/** Random id for a new thread. Not security-sensitive. */
export function newThreadId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Title = first user message, whitespace collapsed, cut to 60 characters. */
export function deriveTitle(messages: InBridgeUIMessage[]): string {
    const first = messages.find((m) => m.role === 'user');
    const text = (first?.parts ?? [])
        .map((p) => (p.type === 'text' ? p.text : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return DEFAULT_TITLE;
    return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1).trimEnd()}…` : text;
}

function isMessage(value: unknown): value is InBridgeUIMessage {
    if (!value || typeof value !== 'object') return false;
    const m = value as Record<string, unknown>;
    return typeof m.id === 'string'
        && (m.role === 'user' || m.role === 'assistant' || m.role === 'system')
        && Array.isArray(m.parts);
}

function isThread(value: unknown): value is Thread {
    if (!value || typeof value !== 'object') return false;
    const t = value as Record<string, unknown>;
    return typeof t.id === 'string' && t.id.length > 0
        && typeof t.title === 'string'
        && typeof t.createdAt === 'number' && Number.isFinite(t.createdAt)
        && typeof t.updatedAt === 'number' && Number.isFinite(t.updatedAt)
        && Array.isArray(t.messages);
}

function byNewest(a: Thread, b: Thread): number {
    return b.updatedAt - a.updatedAt;
}

/**
 * Parse the stored JSON. Never throws: corrupt or foreign data yields [] and
 * malformed threads/messages are dropped rather than crashing the sidebar.
 */
export function parseThreads(raw: string | null | undefined): Thread[] {
    if (!raw) return [];
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        return [];
    }
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    const threads: Thread[] = [];
    for (const item of data) {
        if (!isThread(item) || seen.has(item.id)) continue;
        seen.add(item.id);
        threads.push({ ...item, messages: item.messages.filter(isMessage) });
    }
    return threads.sort(byNewest).slice(0, MAX_THREADS);
}

/** Insert or replace a thread, keep newest first, drop the oldest beyond the cap. */
export function upsertThread(threads: Thread[], thread: Thread): Thread[] {
    return [thread, ...threads.filter((t) => t.id !== thread.id)].sort(byNewest).slice(0, MAX_THREADS);
}

/** Rename a thread. Blank titles are ignored. Does not change updatedAt (order stays put). */
export function renameThread(threads: Thread[], id: string, title: string): Thread[] {
    const clean = title.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!clean) return threads;
    return threads.map((t) => (t.id === id ? { ...t, title: clean } : t));
}

export function deleteThread(threads: Thread[], id: string): Thread[] {
    return threads.filter((t) => t.id !== id);
}

/**
 * Build the next version of a thread from the latest messages. Keeps the
 * original createdAt and any title the user set.
 */
export function buildThread(existing: Thread | undefined, id: string, messages: InBridgeUIMessage[], now: number): Thread {
    return {
        id,
        title: existing?.title ?? deriveTitle(messages),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        messages,
    };
}

export type ThreadGroupKey = 'today' | 'yesterday' | 'week' | 'older';

export interface ThreadGroup {
    key: ThreadGroupKey;
    threads: Thread[];
}

/**
 * Group by local calendar day: Today / Yesterday / Previous 7 days / Older.
 * Empty groups are omitted; order inside a group is newest first.
 */
export function groupThreads(threads: Thread[], now: number = Date.now()): ThreadGroup[] {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const buckets: Record<ThreadGroupKey, Thread[]> = { today: [], yesterday: [], week: [], older: [] };
    for (const t of [...threads].sort(byNewest)) {
        if (t.updatedAt >= today.getTime()) buckets.today.push(t);
        else if (t.updatedAt >= yesterday.getTime()) buckets.yesterday.push(t);
        else if (t.updatedAt >= weekAgo.getTime()) buckets.week.push(t);
        else buckets.older.push(t);
    }
    return (['today', 'yesterday', 'week', 'older'] as const)
        .filter((key) => buckets[key].length > 0)
        .map((key) => ({ key, threads: buckets[key] }));
}

/**
 * Which stored keys hold per-answer state. With `messageIds`, only the state of
 * those messages; without, all of it.
 */
export function answerStateKeys(keys: readonly string[], messageIds?: readonly string[]): string[] {
    const ids = messageIds ? new Set(messageIds) : null;
    return keys.filter((key) => {
        const prefix = ANSWER_STATE_PREFIXES.find((p) => key.startsWith(p));
        if (!prefix) return false;
        return ids ? ids.has(key.slice(prefix.length)) : true;
    });
}

// ── Storage I/O (guarded) ─────────────────────────────────────────────────

function listKeys(storage: KeyedStorageLike): string[] {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key !== null) keys.push(key);
    }
    return keys;
}

/**
 * Remove per-answer state (feedback, checklist ticks). Never throws. Returns
 * the number of keys removed.
 */
export function removeAnswerState(storage: KeyedStorageLike | null, messageIds?: readonly string[]): number {
    if (!storage) return 0;
    try {
        const keys = answerStateKeys(listKeys(storage), messageIds);
        keys.forEach((key) => storage.removeItem(key));
        return keys.length;
    } catch {
        return 0;
    }
}

export function readThreads(storage: StorageLike | null): Thread[] {
    if (!storage) return [];
    try {
        return parseThreads(storage.getItem(HISTORY_KEY));
    } catch {
        return []; // storage access can throw (privacy mode, disabled cookies)
    }
}

/**
 * Write threads. If the browser quota is exceeded, drop the oldest threads one
 * at a time and retry, always keeping at least the newest. Returns the list
 * that was actually stored, or null if nothing could be written.
 */
export function writeThreads(storage: StorageLike | null, threads: Thread[]): Thread[] | null {
    if (!storage) return null;
    let list = [...threads].sort(byNewest).slice(0, MAX_THREADS);
    for (;;) {
        try {
            if (list.length === 0) storage.removeItem(HISTORY_KEY);
            else storage.setItem(HISTORY_KEY, JSON.stringify(list));
            return list;
        } catch {
            if (list.length <= 1) return null;
            list = list.slice(0, -1);
        }
    }
}

// ── Store for useSyncExternalStore ────────────────────────────────────────

const EMPTY: Thread[] = [];
const listeners = new Set<() => void>();
let cache: Thread[] | null = null;

function browserStorage(): KeyedStorageLike | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null;
    }
}

function emit() {
    cache = null;
    listeners.forEach((l) => l());
}

export function subscribeThreads(listener: () => void): () => void {
    listeners.add(listener);
    // Keep tabs in sync: another tab writing history invalidates our cache.
    const onStorage = (e: StorageEvent) => {
        if (e.key === HISTORY_KEY || e.key === null) emit();
    };
    window.addEventListener('storage', onStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);
    };
}

export function getThreadsSnapshot(): Thread[] {
    if (!cache) cache = readThreads(browserStorage());
    return cache;
}

export function getServerThreadsSnapshot(): Thread[] {
    return EMPTY;
}

function commit(next: Thread[]): boolean {
    const stored = writeThreads(browserStorage(), next);
    emit();
    return stored !== null;
}

/**
 * Mirrors local changes elsewhere (the signed-in account). The store stays the
 * source of truth: a listener can never make a local write fail, and a throwing
 * listener is ignored.
 */
export interface HistoryListener {
    onSave(thread: Thread): void;
    onDelete(id: string): void;
    onClear(): void;
}

let listener: HistoryListener | null = null;

export function setHistoryListener(next: HistoryListener | null): void {
    listener = next;
}

function notify(fn: (l: HistoryListener) => void): void {
    if (!listener) return;
    try {
        fn(listener);
    } catch {
        /* mirroring is best-effort */
    }
}

/** Save the latest messages of a thread. Empty threads are not stored. */
export function saveThread(id: string, messages: InBridgeUIMessage[], now: number = Date.now()): boolean {
    if (messages.length === 0) return false;
    const threads = readThreads(browserStorage());
    const existing = threads.find((t) => t.id === id);
    const thread = buildThread(existing, id, messages, now);
    const ok = commit(upsertThread(threads, thread));
    if (ok) notify((l) => l.onSave(thread));
    return ok;
}

export function renameStoredThread(id: string, title: string): boolean {
    const ok = commit(renameThread(readThreads(browserStorage()), id, title));
    const renamed = ok ? readThreads(browserStorage()).find((t) => t.id === id) : undefined;
    if (renamed) notify((l) => l.onSave(renamed));
    return ok;
}

/** Delete one thread and the per-answer state of its messages. */
export function deleteStoredThread(id: string): boolean {
    const storage = browserStorage();
    const threads = readThreads(storage);
    const gone = threads.find((t) => t.id === id);
    if (gone) removeAnswerState(storage, gone.messages.map((m) => m.id));
    const ok = commit(deleteThread(threads, id));
    notify((l) => l.onDelete(id));
    return ok;
}

/** Clear all history, including every answer's feedback and checklist state. */
export function clearStoredThreads(): boolean {
    removeAnswerState(browserStorage());
    const ok = commit([]);
    notify((l) => l.onClear());
    return ok;
}

/**
 * Replace the local threads with `threads` (a merge result) WITHOUT notifying the
 * listener: this is data arriving from the account, not a user action.
 */
export function replaceStoredThreads(threads: Thread[]): boolean {
    return commit(threads);
}

/**
 * Wipe the local copy only (sign-out on a shared device). Unlike
 * clearStoredThreads it never reaches the account.
 */
export function resetLocalThreads(): void {
    removeAnswerState(browserStorage());
    commit([]);
}

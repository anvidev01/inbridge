/**
 * Keeps a signed-in user's chat history in step with their account.
 *
 * The browser's local store (src/lib/history.ts) stays the source of truth while
 * chatting; this module mirrors it to the Go API so a conversation can be
 * continued on any device.
 *
 *  - On sign-in: pull the account's threads, merge with the local ones (newest
 *    `updatedAt` per thread wins), store the result locally, push anything local
 *    that is newer or missing from the account.
 *  - After that: every local save, rename, delete and clear is mirrored.
 *
 * Sync is best-effort and never blocks or breaks chatting: failures are retried
 * and surfaced as a status, never thrown into the UI.
 *
 * Known limit: there are no tombstones. A thread deleted on device A while device
 * B is offline comes back when B next signs in. Acceptable for chat history.
 */

import { authFetch, readOwner, readSession, writeOwner } from './account';
import {
    getThreadsSnapshot, MAX_THREADS, parseThreads, replaceStoredThreads, resetLocalThreads,
    setHistoryListener, type Thread,
} from './history';

/** Browser-safe warning (the server logger reads server-only env vars). */
const log = {
    warn(message: string, fields?: Record<string, unknown>): void {
        if (typeof console !== 'undefined') console.warn(`[thread-sync] ${message}`, fields ?? '');
    },
};

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'error';

// ── Pure merge ─────────────────────────────────────────────────────────────

export interface MergeResult {
    /** What the local store should hold afterwards, newest first, capped. */
    merged: Thread[];
    /** Threads the account is missing or has an older copy of. */
    toPush: Thread[];
}

/**
 * Newest `updatedAt` wins per thread id. Equal timestamps with different titles
 * mean a rename (which does not bump updatedAt): the local copy wins, because a
 * rename happens on the device the user is holding.
 */
export function mergeThreads(local: Thread[], remote: Thread[]): MergeResult {
    const remoteById = new Map(remote.map((t) => [t.id, t]));
    const byId = new Map<string, Thread>(remote.map((t) => [t.id, t]));
    const pushIds = new Set<string>();

    for (const l of local) {
        const r = remoteById.get(l.id);
        const localWins = !r || l.updatedAt > r.updatedAt || (l.updatedAt === r.updatedAt && l.title !== r.title);
        if (localWins) {
            byId.set(l.id, l);
            pushIds.add(l.id);
        }
    }

    const merged = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_THREADS);
    const kept = new Set(merged.map((t) => t.id));
    return { merged, toPush: merged.filter((t) => pushIds.has(t.id) && kept.has(t.id)) };
}

// ── Engine ─────────────────────────────────────────────────────────────────

let debounceMs = 700;
/** Tests only. */
export function setSyncDebounceForTests(ms: number): void {
    debounceMs = ms;
}

let status: SyncStatus = 'off';
const statusListeners = new Set<() => void>();
/** Bumped by start/stop so a slow in-flight sync from a previous session is ignored. */
let generation = 0;
const pending = new Map<string, { thread: Thread; timer: ReturnType<typeof setTimeout> }>();
/** Threads whose last push failed; retried on the next save, reconnect or sign-in. */
const failed = new Map<string, Thread>();
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let lifecycleBound = false;

function setStatus(next: SyncStatus): void {
    if (status === next) return;
    status = next;
    statusListeners.forEach((l) => l());
}

export function getSyncStatus(): SyncStatus {
    return status;
}

export function subscribeSyncStatus(listener: () => void): () => void {
    statusListeners.add(listener);
    return () => { statusListeners.delete(listener); };
}

type PushOutcome = 'ok' | 'rejected' | 'auth';

async function pushThread(t: Thread, keepalive = false): Promise<PushOutcome> {
    const res = await authFetch(
        `/api/v1/chat/threads/${encodeURIComponent(t.id)}`,
        {
            method: 'PUT',
            body: JSON.stringify({ title: t.title, createdAt: t.createdAt, updatedAt: t.updatedAt, messages: t.messages }),
            keepalive,
        },
        2,
    );
    if (res.ok) return 'ok';
    if (res.status === 401) return 'auth';
    // 400/413: this thread can never be accepted; retrying would loop forever.
    if (res.status === 400 || res.status === 413) {
        log.warn('Thread rejected by the account store', { status: res.status, id: t.id });
        return 'rejected';
    }
    throw new Error(`push failed: ${res.status}`);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1) * (i + 1)));
        }
    }
    throw lastError;
}

async function flushOne(id: string, gen: number): Promise<void> {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    try {
        const outcome = await withRetry(() => pushThread(entry.thread));
        if (gen !== generation) return;
        if (outcome === 'auth') return; // authFetch already announced it
        failed.delete(id);
        if (failed.size === 0) setStatus('ok');
    } catch (err) {
        if (gen !== generation) return;
        log.warn('Thread sync failed; will retry', { error: err, id });
        failed.set(id, entry.thread);
        setStatus('error');
        scheduleRetry(gen);
    }
}

function scheduleRetry(gen: number, delayMs = 15_000): void {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => void retryFailed(gen), delayMs);
}

async function retryFailed(gen: number): Promise<void> {
    if (gen !== generation || failed.size === 0) return;
    const items = [...failed.values()];
    setStatus('syncing');
    for (const t of items) {
        try {
            const outcome = await pushThread(t);
            if (gen !== generation) return;
            if (outcome === 'auth') return;
            failed.delete(t.id);
        } catch {
            /* stays in `failed` */
        }
    }
    if (gen !== generation) return;
    if (failed.size === 0) setStatus('ok');
    else {
        setStatus('error');
        scheduleRetry(gen, 30_000);
    }
}

function scheduleSave(thread: Thread, gen: number): void {
    const existing = pending.get(thread.id);
    if (existing) clearTimeout(existing.timer);
    failed.delete(thread.id); // this newer copy supersedes a failed older one
    const timer = setTimeout(() => void flushOne(thread.id, gen), debounceMs);
    pending.set(thread.id, { thread, timer });
}

/** Send what is still waiting (tab closing) without the debounce. Best effort. */
function flushPendingNow(): void {
    for (const [id, entry] of pending) {
        clearTimeout(entry.timer);
        void pushThread(entry.thread, true).catch(() => undefined);
        pending.delete(id);
    }
}

function bindLifecycle(): void {
    if (lifecycleBound || typeof window === 'undefined') return;
    lifecycleBound = true;
    window.addEventListener('pagehide', flushPendingNow);
    window.addEventListener('online', () => {
        if (status !== 'off' && failed.size > 0) void retryFailed(generation);
    });
}

async function pull(): Promise<Thread[]> {
    const res = await authFetch('/api/v1/chat/threads');
    if (!res.ok) throw new Error(`pull failed: ${res.status}`);
    // parseThreads validates shape, de-duplicates, sorts and caps; it takes a string.
    return parseThreads(JSON.stringify(await res.json()));
}

/**
 * Begin mirroring for the signed-in user and reconcile with their account.
 * Safe to call again (e.g. after a login or a page reload); never throws.
 */
export async function startSync(): Promise<void> {
    const session = readSession();
    if (!session) return;

    // Threads cached on this device by a DIFFERENT account must never be merged
    // into this one. Threads from before any sign-in (no owner) are adopted.
    const owner = session.user.email.toLowerCase();
    const previous = readOwner();
    if (previous && previous !== owner) resetLocalThreads();
    writeOwner(owner);

    const gen = ++generation;
    clearTimeout(retryTimer);
    bindLifecycle();
    setHistoryListener({
        onSave: (t) => scheduleSave(t, gen),
        onDelete: (id) => {
            const entry = pending.get(id);
            if (entry) clearTimeout(entry.timer);
            pending.delete(id);
            failed.delete(id);
            void authFetch(`/api/v1/chat/threads/${encodeURIComponent(id)}`, { method: 'DELETE' }, 2).catch((error) => {
                log.warn('Thread delete not mirrored', { error, id });
            });
        },
        onClear: () => {
            pending.forEach((e) => clearTimeout(e.timer));
            pending.clear();
            failed.clear();
            void authFetch('/api/v1/chat/threads', { method: 'DELETE' }, 2).catch((error) => {
                log.warn('Clear not mirrored', { error });
            });
        },
    });

    setStatus('syncing');
    try {
        const remote = await withRetry(pull, 2);
        if (gen !== generation) return; // signed out (or another sign-in) meanwhile
        const { merged, toPush } = mergeThreads(getThreadsSnapshot(), remote);
        replaceStoredThreads(merged);

        for (const t of toPush) {
            if (gen !== generation) return;
            try {
                const outcome = await pushThread(t);
                if (outcome === 'auth') return;
            } catch {
                failed.set(t.id, t);
            }
        }
        if (gen !== generation) return;
        if (failed.size > 0) {
            setStatus('error');
            scheduleRetry(gen);
        } else {
            setStatus('ok');
        }
    } catch (err) {
        if (gen !== generation) return;
        log.warn('Initial thread sync failed; will retry', { error: err });
        setStatus('error');
        // Re-run the whole reconcile later: the local copy is still intact.
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => { if (gen === generation) void startSync(); }, 20_000);
    }
}

/** Stop mirroring (sign-out or expiry). Pending unsent changes are dropped. */
export function stopSync(): void {
    generation++;
    setHistoryListener(null);
    pending.forEach((e) => clearTimeout(e.timer));
    pending.clear();
    failed.clear();
    clearTimeout(retryTimer);
    setStatus('off');
}

/** Sign-out: stop mirroring and forget the account's cached threads on this device. */
export function signOutCleanup(): void {
    stopSync();
    resetLocalThreads();
    writeOwner(null);
}

/**
 * Browser-side account session: who is signed in, and an authenticated fetch to
 * the Go API.
 *
 * The JWT (24 h) and the user's name/email live in localStorage, the same keys the
 * privacy page documents. Nothing here runs on the server.
 */

export const TOKEN_KEY = 'inbridge_token';
export const USER_KEY = 'inbridge_user';
/** Which account the locally cached threads belong to (lowercased email). */
export const OWNER_KEY = 'inbridge_threads_owner';
/** Fired on window when the API rejects the stored token. */
export const AUTH_EXPIRED_EVENT = 'inbridge:auth-expired';

/** On unless explicitly disabled with NEXT_PUBLIC_AUTH_ENABLED=false. */
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'false';

export function apiBase(): string {
    return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/+$/, '');
}

export interface SessionUser {
    name: string;
    email: string;
}

export interface Session {
    token: string;
    user: SessionUser;
}

/** The subset of Web Storage this module needs, so tests can pass a fake. */
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

function browserStorage(): StorageLike | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null;
    }
}

/** Expiry (epoch seconds) from a JWT's payload, or null if it can't be read. */
export function tokenExpiry(token: string): number | null {
    try {
        const part = token.split('.')[1];
        if (!part) return null;
        const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
        const exp = (JSON.parse(json) as { exp?: unknown }).exp;
        return typeof exp === 'number' ? exp : null;
    } catch {
        return null;
    }
}

export function isTokenExpired(token: string, nowMs: number = Date.now()): boolean {
    const exp = tokenExpiry(token);
    return exp !== null && exp * 1000 <= nowMs;
}

/** The stored session, or null if absent, malformed or expired (expired ones are removed). */
export function readSession(storage: StorageLike | null = browserStorage(), nowMs: number = Date.now()): Session | null {
    if (!storage) return null;
    try {
        const token = storage.getItem(TOKEN_KEY);
        const rawUser = storage.getItem(USER_KEY);
        if (!token || !rawUser) return null;
        if (isTokenExpired(token, nowMs)) {
            clearSession(storage);
            return null;
        }
        const parsed = JSON.parse(rawUser) as Partial<SessionUser>;
        if (typeof parsed.name !== 'string' || !parsed.name) return null;
        return { token, user: { name: parsed.name, email: typeof parsed.email === 'string' ? parsed.email : '' } };
    } catch {
        clearSession(storage);
        return null;
    }
}

export function saveSession(token: string, user: SessionUser, storage: StorageLike | null = browserStorage()): void {
    if (!storage) return;
    try {
        storage.setItem(TOKEN_KEY, token);
        storage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
        /* storage full or blocked: the user stays signed in for this page only */
    }
}

export function clearSession(storage: StorageLike | null = browserStorage()): void {
    if (!storage) return;
    try {
        storage.removeItem(TOKEN_KEY);
        storage.removeItem(USER_KEY);
    } catch {
        /* ignore */
    }
}

export function readOwner(storage: StorageLike | null = browserStorage()): string | null {
    try {
        return storage?.getItem(OWNER_KEY) ?? null;
    } catch {
        return null;
    }
}

export function writeOwner(owner: string | null, storage: StorageLike | null = browserStorage()): void {
    if (!storage) return;
    try {
        if (owner) storage.setItem(OWNER_KEY, owner);
        else storage.removeItem(OWNER_KEY);
    } catch {
        /* ignore */
    }
}

/** Statuses a sleeping free-tier host returns before it is routable. */
const TRANSIENT = new Set([404, 502, 503, 504]);

/**
 * fetch with a timeout and retries for cold-start failures. A real API answer
 * (200, 204, 400, 401, 409, 413, 429) is final; only network errors and the
 * transient infrastructure statuses are retried.
 */
export async function fetchWithRetry(url: string, init: RequestInit = {}, attempts = 4, timeoutMs = 30_000): Promise<Response> {
    let lastError: unknown = new Error('The server is waking up. Please try again in a moment.');
    for (let attempt = 0; attempt < attempts; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { ...init, signal: controller.signal });
            if (!TRANSIENT.has(res.status)) return res;
            lastError = new Error(`transient ${res.status}`);
        } catch (err) {
            lastError = err;
        } finally {
            clearTimeout(timer);
        }
        if (attempt < attempts - 1) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    throw lastError;
}

/**
 * Authenticated request to the Go API. A 401 means the token is expired or
 * invalid: the session is cleared and AUTH_EXPIRED_EVENT fires so the UI can ask
 * the user to sign in again.
 */
export async function authFetch(path: string, init: RequestInit = {}, attempts = 4): Promise<Response> {
    const session = readSession();
    if (!session) {
        notifyExpired();
        throw new Error('not signed in');
    }
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${session.token}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const res = await fetchWithRetry(`${apiBase()}${path}`, { ...init, headers }, attempts);
    if (res.status === 401) {
        clearSession();
        notifyExpired();
    }
    return res;
}

function notifyExpired(): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

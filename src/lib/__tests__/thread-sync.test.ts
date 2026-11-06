import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_EXPIRED_EVENT, OWNER_KEY, TOKEN_KEY, USER_KEY } from '../account';
import {
    HISTORY_KEY, clearStoredThreads, deleteStoredThread, getThreadsSnapshot, readThreads, saveThread, type Thread,
} from '../history';
import { getSyncStatus, mergeThreads, setSyncDebounceForTests, signOutCleanup, startSync, stopSync } from '../thread-sync';
import { fakeJwt } from './jwt-helper';
import type { InBridgeUIMessage } from '../chat/protocol';

const msg = (id: string, text: string): InBridgeUIMessage =>
    ({ id, role: 'user', parts: [{ type: 'text', text }] }) as InBridgeUIMessage;

const thread = (id: string, updatedAt: number, title = id): Thread => ({
    id, title, createdAt: 1, updatedAt, messages: [msg(`${id}-m`, title)],
});

describe('mergeThreads', () => {
    test('union of both sides, newest first', () => {
        const { merged } = mergeThreads([thread('a', 10)], [thread('b', 20)]);
        assert.deepEqual(merged.map((t) => t.id), ['b', 'a']);
    });

    test('newer side wins per thread', () => {
        const { merged, toPush } = mergeThreads(
            [thread('x', 50, 'local'), thread('y', 5, 'old-local')],
            [thread('x', 40, 'remote'), thread('y', 9, 'new-remote')],
        );
        assert.equal(merged.find((t) => t.id === 'x')?.title, 'local');
        assert.equal(merged.find((t) => t.id === 'y')?.title, 'new-remote');
        assert.deepEqual(toPush.map((t) => t.id), ['x']);
    });

    test('local-only threads are pushed; remote-only are not', () => {
        const { toPush } = mergeThreads([thread('only-local', 1)], [thread('only-remote', 2)]);
        assert.deepEqual(toPush.map((t) => t.id), ['only-local']);
    });

    test('equal timestamps with a different title is a rename: local wins and is pushed', () => {
        const { merged, toPush } = mergeThreads([thread('r', 7, 'renamed')], [thread('r', 7, 'original')]);
        assert.equal(merged[0].title, 'renamed');
        assert.deepEqual(toPush.map((t) => t.id), ['r']);
    });

    test('identical copies are neither changed nor pushed', () => {
        const t = thread('same', 3);
        const { merged, toPush } = mergeThreads([t], [{ ...t }]);
        assert.equal(merged.length, 1);
        assert.equal(toPush.length, 0);
    });

    test('result is capped at 50, dropping the oldest, and never pushes a dropped thread', () => {
        const many = Array.from({ length: 60 }, (_, i) => thread(`t${i}`, i + 1));
        const { merged, toPush } = mergeThreads(many, []);
        assert.equal(merged.length, 50);
        assert.equal(merged[0].id, 't59');
        assert.equal(merged.some((t) => t.id === 't0'), false);
        assert.equal(toPush.some((t) => t.id === 't0'), false);
    });
});

// ── Engine, against a fake window + fake API ───────────────────────────────

interface Call { method: string; path: string; body?: unknown }

function setup(opts: { remote?: Thread[]; owner?: string; local?: Thread[]; email?: string } = {}) {
    const store = new Map<string, string>();
    const events: string[] = [];
    (globalThis as unknown as { window: unknown }).window = {
        localStorage: {
            get length() { return store.size; },
            key: (i: number) => [...store.keys()][i] ?? null,
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => { store.set(k, v); },
            removeItem: (k: string) => { store.delete(k); },
        },
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: (e: Event) => { events.push(e.type); return true; },
    };
    store.set(TOKEN_KEY, fakeJwt(Math.floor(Date.now() / 1000) + 3600));
    store.set(USER_KEY, JSON.stringify({ name: 'Asha', email: opts.email ?? 'asha@example.com' }));
    if (opts.owner) store.set(OWNER_KEY, opts.owner);
    if (opts.local) store.set(HISTORY_KEY, JSON.stringify(opts.local));

    const calls: Call[] = [];
    let remote = opts.remote ?? [];
    let status = 200;
    (globalThis as { fetch: unknown }).fetch = async (url: string, init: RequestInit = {}) => {
        const path = new URL(url).pathname;
        const method = init.method ?? 'GET';
        calls.push({ method, path, body: init.body ? JSON.parse(String(init.body)) : undefined });
        if (status !== 200) return new Response('nope', { status });
        if (method === 'GET') return new Response(JSON.stringify(remote), { status: 200 });
        return new Response(null, { status: 204 });
    };
    return { store, calls, events, setRemote: (r: Thread[]) => { remote = r; }, failWith: (s: number) => { status = s; } };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('sync engine', () => {
    beforeEach(() => setSyncDebounceForTests(5));
    afterEach(() => {
        stopSync();
        delete (globalThis as { window?: unknown }).window;
    });

    test('sign-in merges account and device threads and pushes what the account lacks', async () => {
        const env = setup({
            local: [thread('device-only', 100), thread('shared', 300, 'device copy')],
            remote: [thread('account-only', 200), thread('shared', 250, 'account copy')],
        });
        await startSync();

        const local = readThreads(window.localStorage);
        assert.deepEqual(local.map((t) => t.id), ['shared', 'account-only', 'device-only']);
        assert.equal(local.find((t) => t.id === 'shared')?.title, 'device copy');

        const puts = env.calls.filter((c) => c.method === 'PUT').map((c) => c.path.split('/').pop()).sort();
        assert.deepEqual(puts, ['device-only', 'shared']);
        assert.equal(getSyncStatus(), 'ok');
    });

    test('later saves are mirrored, debounced into one PUT', async () => {
        const env = setup();
        await startSync();
        env.calls.length = 0;

        saveThread('t1', [msg('a', 'first')], 1000);
        saveThread('t1', [msg('a', 'first'), msg('b', 'second')], 2000);
        await wait(60);

        const puts = env.calls.filter((c) => c.method === 'PUT');
        assert.equal(puts.length, 1);
        assert.equal((puts[0].body as { messages: unknown[] }).messages.length, 2);
        assert.equal((puts[0].body as { updatedAt: number }).updatedAt, 2000);
    });

    test('deleting and clearing are mirrored', async () => {
        const env = setup();
        await startSync();
        saveThread('t1', [msg('a', 'hi')], 1000);
        await wait(40);
        env.calls.length = 0;

        deleteStoredThread('t1');
        clearStoredThreads();
        await wait(20);
        assert.deepEqual(env.calls.map((c) => `${c.method} ${c.path}`), [
            'DELETE /api/v1/chat/threads/t1',
            'DELETE /api/v1/chat/threads',
        ]);
    });

    test('a pending save that is then deleted is never sent', async () => {
        const env = setup();
        await startSync();
        env.calls.length = 0;
        saveThread('gone', [msg('a', 'hi')], 1000);
        deleteStoredThread('gone');
        await wait(60);
        assert.equal(env.calls.some((c) => c.method === 'PUT'), false);
    });

    test("another account's cached threads are discarded, never pushed", async () => {
        const env = setup({ owner: 'someone-else@example.com', local: [thread('private-to-someone-else', 5)] });
        await startSync();
        assert.equal(readThreads(window.localStorage).some((t) => t.id === 'private-to-someone-else'), false);
        assert.equal(env.calls.some((c) => c.method === 'PUT'), false);
        assert.equal(window.localStorage.getItem(OWNER_KEY), 'asha@example.com');
    });

    test('threads made before any sign-in are adopted by the account', async () => {
        const env = setup({ local: [thread('anon', 5)] });
        await startSync();
        assert.equal(env.calls.filter((c) => c.method === 'PUT').length, 1);
    });

    test('sign-out wipes the local copy WITHOUT touching the account', async () => {
        const env = setup({ remote: [thread('kept-on-server', 9)] });
        await startSync();
        assert.equal(getThreadsSnapshot().length, 1);
        env.calls.length = 0;

        signOutCleanup();
        await wait(20);
        assert.equal(readThreads(window.localStorage).length, 0);
        assert.equal(window.localStorage.getItem(OWNER_KEY), null);
        assert.equal(env.calls.length, 0, 'no DELETE may reach the account on sign-out');
        assert.equal(getSyncStatus(), 'off');
    });

    test('after stopSync, saves are no longer mirrored', async () => {
        const env = setup();
        await startSync();
        stopSync();
        env.calls.length = 0;
        saveThread('t', [msg('a', 'hi')], 1000);
        await wait(40);
        assert.equal(env.calls.length, 0);
    });

    test('a 401 from the account clears the session and announces expiry', async () => {
        const env = setup({ local: [thread('a', 1)] });
        env.failWith(401);
        await startSync();
        assert.ok(env.events.includes(AUTH_EXPIRED_EVENT));
        assert.equal(window.localStorage.getItem(TOKEN_KEY), null);
    });

    test('an unreachable account leaves the local threads intact and reports an error', async () => {
        const env = setup({ local: [thread('a', 1)] });
        env.failWith(500);
        // withRetry sleeps between attempts; the status flips to error once they are spent.
        const started = startSync();
        await started;
        assert.equal(readThreads(window.localStorage).length, 1);
        assert.equal(getSyncStatus(), 'error');
    });
});

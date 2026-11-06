import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    TOKEN_KEY, USER_KEY, clearSession, isTokenExpired, readOwner, readSession, saveSession, tokenExpiry, writeOwner,
    type StorageLike,
} from '../account';
import { fakeJwt } from './jwt-helper';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
        data,
        getItem: (k) => data.get(k) ?? null,
        setItem: (k, v) => { data.set(k, v); },
        removeItem: (k) => { data.delete(k); },
    };
}

const NOW = 1_700_000_000_000;

describe('tokenExpiry / isTokenExpired', () => {
    test('reads exp from a JWT payload', () => {
        assert.equal(tokenExpiry(fakeJwt(1234)), 1234);
    });

    test('returns null for malformed tokens instead of throwing', () => {
        assert.equal(tokenExpiry('nonsense'), null);
        assert.equal(tokenExpiry('a.!!!.c'), null);
        assert.equal(tokenExpiry(''), null);
    });

    test('expired when exp is in the past, valid when in the future', () => {
        assert.equal(isTokenExpired(fakeJwt(NOW / 1000 - 1), NOW), true);
        assert.equal(isTokenExpired(fakeJwt(NOW / 1000 + 3600), NOW), false);
    });

    test('an unreadable token is not treated as expired (the server decides)', () => {
        assert.equal(isTokenExpired('nonsense', NOW), false);
    });
});

describe('session storage', () => {
    test('round-trips a session', () => {
        const s = fakeStorage();
        const token = fakeJwt(NOW / 1000 + 3600);
        saveSession(token, { name: 'Asha', email: 'asha@example.com' }, s);
        assert.deepEqual(readSession(s, NOW), { token, user: { name: 'Asha', email: 'asha@example.com' } });
    });

    test('an expired session is dropped and removed', () => {
        const s = fakeStorage();
        saveSession(fakeJwt(NOW / 1000 - 10), { name: 'Asha', email: 'a@b.in' }, s);
        assert.equal(readSession(s, NOW), null);
        assert.equal(s.data.has(TOKEN_KEY), false);
        assert.equal(s.data.has(USER_KEY), false);
    });

    test('corrupt user JSON yields no session and cleans up', () => {
        const s = fakeStorage();
        s.setItem(TOKEN_KEY, fakeJwt(NOW / 1000 + 3600));
        s.setItem(USER_KEY, '{not json');
        assert.equal(readSession(s, NOW), null);
        assert.equal(s.data.has(TOKEN_KEY), false);
    });

    test('a token without a stored user is not a session', () => {
        const s = fakeStorage();
        s.setItem(TOKEN_KEY, fakeJwt(NOW / 1000 + 3600));
        assert.equal(readSession(s, NOW), null);
    });

    test('clearSession removes both keys; null storage is a no-op', () => {
        const s = fakeStorage();
        saveSession(fakeJwt(NOW / 1000 + 3600), { name: 'A', email: 'a@b.in' }, s);
        clearSession(s);
        assert.equal(s.data.size, 0);
        assert.doesNotThrow(() => clearSession(null));
        assert.equal(readSession(null), null);
    });

    test('owner marker round-trips and can be cleared', () => {
        const s = fakeStorage();
        assert.equal(readOwner(s), null);
        writeOwner('a@b.in', s);
        assert.equal(readOwner(s), 'a@b.in');
        writeOwner(null, s);
        assert.equal(readOwner(s), null);
    });
});

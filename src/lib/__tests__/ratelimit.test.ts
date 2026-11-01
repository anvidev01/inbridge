import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    checkRateLimit,
    clientIp,
    evictExpired,
    resetRateLimits,
    SWEEP_INTERVAL_MS,
    sweepTimerActive,
    trackedKeyCount,
    WINDOW_MS,
} from '../ai/ratelimit';

describe('checkRateLimit', () => {
    beforeEach(() => resetRateLimits());

    test('allows up to the limit, then blocks', async () => {
        for (let i = 0; i < 3; i++) assert.ok((await checkRateLimit('ip', 3)).success);
        const blocked = await checkRateLimit('ip', 3);
        assert.equal(blocked.success, false);
        assert.equal(blocked.remaining, 0);
    });

    test('keys are independent', async () => {
        await checkRateLimit('a', 1);
        assert.equal((await checkRateLimit('a', 1)).success, false);
        assert.ok((await checkRateLimit('feedback:a', 1)).success);
    });

    test('prunes expired entries instead of growing forever', async (t) => {
        const realNow = Date.now;
        let now = realNow();
        t.after(() => {
            Date.now = realNow;
        });
        Date.now = () => now;

        for (let i = 0; i < 50; i++) await checkRateLimit(`ip${i}`, 5);
        assert.equal(trackedKeyCount(), 50);

        now += 2 * 60 * 1000;
        await checkRateLimit('fresh', 5);
        assert.equal(trackedKeyCount(), 1);
    });
});

describe('rate-limit retention (IPs are held only for the window)', () => {
    beforeEach(() => resetRateLimits());

    test('evictExpired removes only entries whose window has ended', async (t) => {
        const realNow = Date.now;
        let now = 1_000_000;
        t.after(() => {
            Date.now = realNow;
        });
        Date.now = () => now;

        await checkRateLimit('old', 5);
        now += WINDOW_MS / 2;
        await checkRateLimit('new', 5);
        assert.equal(trackedKeyCount(), 2);

        now += WINDOW_MS / 2; // 'old' window just ended, 'new' is half way
        assert.equal(evictExpired(now), 1);
        assert.equal(trackedKeyCount(), 1);

        now += WINDOW_MS / 2;
        assert.equal(evictExpired(now), 1);
        assert.equal(trackedKeyCount(), 0);
        assert.equal(sweepTimerActive(), false, 'timer stops when nothing is tracked');
    });

    test('a background sweep evicts expired IPs even with no further requests', async (t) => {
        t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 5_000_000 });
        t.after(() => resetRateLimits());

        await checkRateLimit('1.2.3.4', 5);
        await checkRateLimit('5.6.7.8', 5);
        assert.equal(trackedKeyCount(), 2);
        assert.equal(sweepTimerActive(), true);

        // No requests arrive. Within one sweep interval after the window ends,
        // both IPs are gone.
        t.mock.timers.tick(WINDOW_MS + SWEEP_INTERVAL_MS);
        assert.equal(trackedKeyCount(), 0);
        assert.equal(sweepTimerActive(), false);
    });

    test('an active window is not evicted early', async (t) => {
        t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 9_000_000 });
        t.after(() => resetRateLimits());

        await checkRateLimit('ip', 1);
        t.mock.timers.tick(WINDOW_MS - SWEEP_INTERVAL_MS);
        assert.equal(trackedKeyCount(), 1);
        assert.equal((await checkRateLimit('ip', 1)).success, false, 'still limited inside the window');
    });
});

describe('clientIp', () => {
    test('uses the first x-forwarded-for entry, then x-real-ip', () => {
        assert.equal(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })), '1.2.3.4');
        assert.equal(clientIp(new Headers({ 'x-real-ip': '5.6.7.8' })), '5.6.7.8');
        assert.equal(clientIp(new Headers()), '127.0.0.1');
    });
});

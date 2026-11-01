import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, clientIp, resetRateLimits, trackedKeyCount } from '../ai/ratelimit';

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

describe('clientIp', () => {
    test('uses the first x-forwarded-for entry, then x-real-ip', () => {
        assert.equal(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })), '1.2.3.4');
        assert.equal(clientIp(new Headers({ 'x-real-ip': '5.6.7.8' })), '5.6.7.8');
        assert.equal(clientIp(new Headers()), '127.0.0.1');
    });
});

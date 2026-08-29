import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    applyBreakerState,
    availableProviders,
    resetProviderHealthCache,
} from '../ai/provider-health';
import type { LLMProvider } from '../observability/telemetry';

const FULL_CHAIN: LLMProvider[] = ['anthropic', 'gemini', 'groq'];

describe('applyBreakerState', () => {
    test('drops providers whose breaker is open, preserving order', () => {
        const { chain, skipped } = applyBreakerState(FULL_CHAIN, ['groq', 'anthropic']);
        assert.deepEqual(chain, ['anthropic', 'groq']);
        assert.deepEqual(skipped, ['gemini']);
    });

    // Fail open: an unknown answer must not narrow the chain.
    test('returns the chain untouched when availability is unknown', () => {
        const { chain, skipped } = applyBreakerState(FULL_CHAIN, null);
        assert.deepEqual(chain, FULL_CHAIN);
        assert.deepEqual(skipped, []);
    });

    // With every breaker open there is nothing to lose by trying; returning an
    // empty chain would turn a degraded service into a hard outage.
    test('keeps the full chain when every provider is open', () => {
        const { chain, skipped } = applyBreakerState(FULL_CHAIN, []);
        assert.deepEqual(chain, FULL_CHAIN);
        assert.deepEqual(skipped, []);
    });

    test('ignores available providers that are not in the chain', () => {
        const { chain } = applyBreakerState(['anthropic'], ['anthropic', 'gemini', 'groq']);
        assert.deepEqual(chain, ['anthropic']);
    });
});

describe('availableProviders', () => {
    let originalFetch: typeof globalThis.fetch;
    let env: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        env = { ...process.env };
        resetProviderHealthCache();
        process.env.INTERNAL_METRICS_URL = 'http://backend:8080';
        process.env.INTERNAL_API_TOKEN = 'test-token';
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        process.env = env;
        resetProviderHealthCache();
    });

    test('returns the available list from the backend', async () => {
        globalThis.fetch = (async () =>
            new Response(JSON.stringify({ available: ['anthropic', 'groq'] }), { status: 200 })) as any;

        assert.deepEqual(await availableProviders(), ['anthropic', 'groq']);
    });

    test('caches the answer instead of calling per request', async () => {
        let calls = 0;
        globalThis.fetch = (async () => {
            calls++;
            return new Response(JSON.stringify({ available: ['anthropic'] }), { status: 200 });
        }) as any;

        await availableProviders();
        await availableProviders();
        await availableProviders();

        assert.equal(calls, 1, 'repeat lookups within the TTL must be served from cache');
    });

    test('collapses concurrent lookups into one request', async () => {
        let calls = 0;
        globalThis.fetch = (async () => {
            calls++;
            await new Promise((r) => setTimeout(r, 20));
            return new Response(JSON.stringify({ available: ['gemini'] }), { status: 200 });
        }) as any;

        const results = await Promise.all([
            availableProviders(),
            availableProviders(),
            availableProviders(),
        ]);

        assert.equal(calls, 1, 'a cold cache under load must not stampede the backend');
        for (const r of results) assert.deepEqual(r, ['gemini']);
    });

    test('fails open on transport error', async () => {
        globalThis.fetch = (async () => {
            throw new Error('ECONNREFUSED');
        }) as any;

        assert.equal(await availableProviders(), null);
    });

    test('fails open on a non-200 response', async () => {
        globalThis.fetch = (async () => new Response('nope', { status: 503 })) as any;
        assert.equal(await availableProviders(), null);
    });

    test('fails open on a malformed body', async () => {
        globalThis.fetch = (async () => new Response(JSON.stringify({ oops: true }), { status: 200 })) as any;
        assert.equal(await availableProviders(), null);
    });

    test('fails open when the backend is not configured', async () => {
        delete process.env.INTERNAL_METRICS_URL;
        delete process.env.NEXT_PUBLIC_API_URL;

        let called = false;
        globalThis.fetch = (async () => {
            called = true;
            return new Response('{}', { status: 200 });
        }) as any;

        assert.equal(await availableProviders(), null);
        assert.equal(called, false);
    });
});

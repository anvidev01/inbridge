import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryBatch, classifyError } from '../observability/telemetry';

describe('classifyError', () => {
    const cases: Array<[string, string]> = [
        ['Anthropic key missing', 'missing_key'],
        ['Groq API Key is missing. Please set GROQ_API_KEY', 'missing_key'],
        ['429 Too Many Requests: rate limit exceeded', 'rate_limit'],
        ['quota exceeded for project', 'rate_limit'],
        ['socket hang up: ETIMEDOUT', 'timeout'],
        ['Request timed out after 30000ms', 'timeout'],
        ['upstream returned 503', 'api_error'],
    ];

    for (const [message, expected] of cases) {
        test(`classifies "${message.slice(0, 32)}" as ${expected}`, () => {
            assert.equal(classifyError(new Error(message)), expected);
        });
    }

    test('falls back to unknown for an empty error', () => {
        assert.equal(classifyError(undefined), 'unknown');
        assert.equal(classifyError(new Error('')), 'unknown');
    });
});

describe('TelemetryBatch', () => {
    let env: NodeJS.ProcessEnv;

    beforeEach(() => {
        env = { ...process.env };
    });

    afterEach(() => {
        process.env = env;
    });

    test('buffers events until flushed', () => {
        const batch = new TelemetryBatch();
        assert.equal(batch.size, 0);

        batch.llmSuccess('anthropic', 812.6);
        batch.failover('anthropic', 'gemini', 'api_error');
        batch.ragCache('hit', 'cache', 2.4);

        assert.equal(batch.size, 3);
    });

    test('rounds sub-millisecond durations to integers', async () => {
        const batch = new TelemetryBatch();
        batch.llmSuccess('groq', 812.6);

        let captured: any;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async (_url: string, init: any) => {
            captured = JSON.parse(init.body);
            return new Response('{}', { status: 202 });
        }) as any;

        process.env.INTERNAL_METRICS_URL = 'http://backend:8080';
        process.env.INTERNAL_API_TOKEN = 'test-token';

        try {
            await batch.flush();
        } finally {
            globalThis.fetch = originalFetch;
        }

        assert.equal(captured.events[0].duration_ms, 813);
    });

    test('sends the shared secret header and clears the buffer', async () => {
        const batch = new TelemetryBatch();
        batch.ragCache('miss', 'vector_store', 140);

        let headers: any;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async (_url: string, init: any) => {
            headers = init.headers;
            return new Response('{}', { status: 202 });
        }) as any;

        process.env.INTERNAL_METRICS_URL = 'http://backend:8080';
        process.env.INTERNAL_API_TOKEN = 'test-token';

        try {
            await batch.flush();
        } finally {
            globalThis.fetch = originalFetch;
        }

        assert.equal(headers['X-Internal-Token'], 'test-token');
        assert.equal(batch.size, 0, 'flush must drain the buffer');
    });

    // Telemetry must never be able to fail the chat request that produced it.
    test('swallows transport failures', async () => {
        const batch = new TelemetryBatch();
        batch.llmSuccess('anthropic', 100);

        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async () => {
            throw new Error('ECONNREFUSED');
        }) as any;

        process.env.INTERNAL_METRICS_URL = 'http://backend:8080';
        process.env.INTERNAL_API_TOKEN = 'test-token';

        try {
            await assert.doesNotReject(() => batch.flush());
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('is a no-op when the ingest URL or token is unconfigured', async () => {
        const batch = new TelemetryBatch();
        batch.llmSuccess('anthropic', 100);

        let called = false;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async () => {
            called = true;
            return new Response('{}', { status: 202 });
        }) as any;

        delete process.env.INTERNAL_METRICS_URL;
        delete process.env.NEXT_PUBLIC_API_URL;
        delete process.env.INTERNAL_API_TOKEN;

        try {
            await batch.flush();
        } finally {
            globalThis.fetch = originalFetch;
        }

        assert.equal(called, false, 'must not POST without a configured target');
        assert.equal(batch.size, 0);
    });

    test('flushing an empty batch makes no request', async () => {
        const batch = new TelemetryBatch();
        let called = false;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async () => {
            called = true;
            return new Response('{}', { status: 202 });
        }) as any;

        try {
            await batch.flush();
        } finally {
            globalThis.fetch = originalFetch;
        }
        assert.equal(called, false);
    });
});

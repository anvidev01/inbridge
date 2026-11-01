import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    attemptTimeoutMs,
    DEFAULT_FIRST_TOKEN_TIMEOUT_MS,
    firstTokenDeadline,
    routeChatStream,
    ProviderUnavailableError,
    type RouterDeps,
} from '../ai/router';
import type { ProviderInput, ProviderStream } from '../ai/generation';
import { TelemetryBatch } from '../observability/telemetry';
import type { LLMProvider } from '../observability/telemetry';

const INPUT: ProviderInput = { turns: [{ role: 'user', content: 'hi' }], system: 'sys' };

function chunks(...parts: string[]): ProviderStream {
    return async function* () {
        for (const p of parts) yield p;
    };
}

/** Fails lazily, on first iteration, like a real 429 from a provider stream. */
function failing(message: string): ProviderStream {
    return async function* () {
        throw new Error(message);
    };
}

function deps(providers: Partial<Record<LLMProvider, ProviderStream>>, overrides: Partial<RouterDeps> = {}): RouterDeps {
    const order = Object.keys(providers) as LLMProvider[];
    return {
        providers: providers as Record<LLMProvider, ProviderStream>,
        buildChain: () => order,
        availableProviders: async () => null,
        firstTokenTimeoutMs: 1000,
        ...overrides,
    };
}

async function collect(stream: AsyncIterable<string>): Promise<string> {
    let out = '';
    for await (const c of stream) out += c;
    return out;
}

function events(t: TelemetryBatch) {
    return (t as unknown as { events: Array<{ type: string }> }).events.map((e) => e.type);
}

describe('routeChatStream', () => {
    test('streams from the first provider when it works', async () => {
        const r = await routeChatStream(INPUT, {}, deps({ anthropic: chunks('Hello', ' world') }));
        assert.equal(r.provider, 'anthropic');
        assert.equal(await collect(r.stream), 'Hello world');
    });

    test('fails over when a provider errors lazily before its first token', async () => {
        const telemetry = new TelemetryBatch();
        const r = await routeChatStream(
            INPUT,
            { telemetry },
            deps({ anthropic: failing('429 rate limit'), groq: chunks('from groq') })
        );
        assert.equal(r.provider, 'groq');
        assert.equal(await collect(r.stream), 'from groq');
        assert.deepEqual(events(telemetry), ['llm_request', 'llm_failover', 'llm_request']);
    });

    test('treats an empty or whitespace-only response as a failure', async () => {
        const r = await routeChatStream(INPUT, {}, deps({ anthropic: chunks('', '  \n'), gemini: chunks('ok') }));
        assert.equal(r.provider, 'gemini');
    });

    test('strips <think> blocks and leading whitespace', async () => {
        const r = await routeChatStream(INPUT, {}, deps({ groq: chunks('<think>plan', '</think>\n\n', 'Answer') }));
        assert.equal(await collect(r.stream), 'Answer');
    });

    test('a think-only response fails over', async () => {
        const r = await routeChatStream(INPUT, {}, deps({ groq: chunks('<think>only thoughts</think>'), gemini: chunks('real') }));
        assert.equal(r.provider, 'gemini');
    });

    test('fails over when the first token times out', async () => {
        const hang: ProviderStream = async function* () {
            await new Promise(() => {});
            yield 'never';
        };
        const r = await routeChatStream(
            INPUT,
            {},
            deps({ anthropic: hang, groq: chunks('fast') }, { firstTokenTimeoutMs: 20 })
        );
        assert.equal(r.provider, 'groq');
    });

    test('a near deadline shortens the first-token wait below the per-provider cap', async () => {
        const hang: ProviderStream = async function* () {
            await new Promise(() => {});
            yield 'never';
        };
        const started = Date.now();
        await assert.rejects(
            routeChatStream(
                INPUT,
                { firstTokenDeadline: Date.now() + 30 },
                deps({ anthropic: hang }, { firstTokenTimeoutMs: 5000 })
            ),
            ProviderUnavailableError
        );
        assert.ok(Date.now() - started < 1000, 'gave up at the deadline, not after the 5s cap');
    });

    test('does not try further providers once the deadline has passed', async () => {
        let groqCalled = false;
        const groq: ProviderStream = async function* () {
            groqCalled = true;
            yield 'late';
        };
        await assert.rejects(
            routeChatStream(INPUT, { firstTokenDeadline: Date.now() - 1 }, deps({ anthropic: chunks('a'), groq })),
            ProviderUnavailableError
        );
        assert.equal(groqCalled, false);
    });

    test('throws ProviderUnavailableError when every provider fails', async () => {
        await assert.rejects(
            routeChatStream(INPUT, {}, deps({ anthropic: failing('boom'), groq: failing('boom') })),
            ProviderUnavailableError
        );
    });

    test('throws ProviderUnavailableError when nothing is configured', async () => {
        await assert.rejects(routeChatStream(INPUT, {}, deps({})), ProviderUnavailableError);
    });

    test('does not fail over when the user aborted', async () => {
        const controller = new AbortController();
        let groqCalled = false;
        const abortsThenFails: ProviderStream = async function* () {
            controller.abort();
            const err = new Error('aborted');
            err.name = 'AbortError';
            throw err;
        };
        const groq: ProviderStream = async function* () {
            groqCalled = true;
            yield 'x';
        };
        await assert.rejects(
            routeChatStream({ ...INPUT, signal: controller.signal }, {}, deps({ anthropic: abortsThenFails, groq })),
            /aborted/
        );
        assert.equal(groqCalled, false);
    });

    test('passes the user abort through to the chosen provider', async () => {
        const controller = new AbortController();
        let seen: AbortSignal | undefined;
        const provider: ProviderStream = async function* (input) {
            seen = input.signal;
            yield 'first';
        };
        const r = await routeChatStream({ ...INPUT, signal: controller.signal }, {}, deps({ anthropic: provider }));
        controller.abort();
        assert.equal(seen?.aborted, true);
        await collect(r.stream);
    });

    test('skips providers whose breaker is open', async () => {
        const r = await routeChatStream(
            INPUT,
            {},
            deps({ anthropic: chunks('a'), groq: chunks('g') }, { availableProviders: async () => ['groq'] })
        );
        assert.equal(r.provider, 'groq');
    });
});

describe('first-token budget', () => {
    test('deadline is route start + maxDuration - generation reserve', () => {
        assert.equal(firstTokenDeadline(1_000, 60_000, 25_000), 36_000);
    });

    test('attempt timeout is min(cap, time left), never negative', () => {
        assert.equal(attemptTimeoutMs(10_000, undefined, 0), 10_000);
        assert.equal(attemptTimeoutMs(10_000, 50_000, 0), 10_000);
        assert.equal(attemptTimeoutMs(10_000, 4_000, 0), 4_000);
        assert.equal(attemptTimeoutMs(10_000, 4_000, 9_000), 0);
    });

    test('default per-provider cap is 10s', () => {
        assert.equal(DEFAULT_FIRST_TOKEN_TIMEOUT_MS, 10_000);
    });
});

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildChain } from '../ai/chain';

const ALL_KEYS = {
    ANTHROPIC_API_KEY: 'a',
    GOOGLE_GEMINI_API_KEY: 'g',
    GROQ_API_KEY: 'q',
};

describe('buildChain', () => {
    test('defaults to anthropic first, then the preference order', () => {
        assert.deepEqual(buildChain(undefined, { ...ALL_KEYS }), ['anthropic', 'gemini', 'groq']);
    });

    test('honours ACTIVE_AI_PROVIDER as the primary', () => {
        assert.deepEqual(
            buildChain(undefined, { ...ALL_KEYS, ACTIVE_AI_PROVIDER: 'groq' }),
            ['groq', 'anthropic', 'gemini']
        );
    });

    test('an explicit request beats ACTIVE_AI_PROVIDER', () => {
        assert.deepEqual(
            buildChain('gemini', { ...ALL_KEYS, ACTIVE_AI_PROVIDER: 'groq' }),
            ['gemini', 'anthropic', 'groq']
        );
    });

    test("treats the legacy 'both' value as no specific primary", () => {
        assert.deepEqual(
            buildChain(undefined, { ...ALL_KEYS, ACTIVE_AI_PROVIDER: 'both' }),
            ['anthropic', 'gemini', 'groq']
        );
    });

    test('ignores an unrecognised ACTIVE_AI_PROVIDER rather than making it primary', () => {
        assert.deepEqual(
            buildChain(undefined, { ...ALL_KEYS, ACTIVE_AI_PROVIDER: 'openai' }),
            ['anthropic', 'gemini', 'groq']
        );
    });

    // The reason this matters: an unconfigured provider left in the chain would
    // throw "key missing" on every request, which the router counts as a
    // failover. A single-provider deployment would then emit a failover per
    // request and keep the failover-spike webhook alert permanently firing.
    test('drops providers with no API key', () => {
        assert.deepEqual(
            buildChain(undefined, { ANTHROPIC_API_KEY: 'a' }),
            ['anthropic']
        );
        assert.deepEqual(
            buildChain(undefined, { GROQ_API_KEY: 'q' }),
            ['groq']
        );
    });

    test('drops an explicitly requested provider that has no key', () => {
        assert.deepEqual(
            buildChain('gemini', { ANTHROPIC_API_KEY: 'a' }),
            ['anthropic'],
            'should serve from a working provider rather than fail'
        );
    });

    test('returns an empty chain when nothing is configured', () => {
        assert.deepEqual(buildChain(undefined, {}), []);
    });
});

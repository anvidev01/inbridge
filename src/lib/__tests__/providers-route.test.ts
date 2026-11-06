import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../../app/api/internal/providers/route';

const req = (token?: string) =>
    new Request('http://x/api/internal/providers', { headers: token ? { 'x-internal-token': token } : {} });

describe('GET /api/internal/providers', () => {
    let env: NodeJS.ProcessEnv;
    beforeEach(() => {
        env = { ...process.env };
        process.env.INTERNAL_API_TOKEN = 'secret-token';
        process.env.GROQ_API_KEY = 'gsk-SECRET-VALUE';
        process.env.GOOGLE_GEMINI_API_KEY = 'AIza-SECRET-VALUE';
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.ACTIVE_AI_PROVIDER;
    });
    afterEach(() => { process.env = env; });

    test('404 without the token, with a wrong token, and when no token is configured', async () => {
        assert.equal((await GET(req())).status, 404);
        assert.equal((await GET(req('wrong'))).status, 404);
        delete process.env.INTERNAL_API_TOKEN;
        assert.equal((await GET(req('secret-token'))).status, 404);
        assert.equal((await GET(req(''))).status, 404);
    });

    test('a token stored with stray whitespace or a newline still matches', async () => {
        process.env.INTERNAL_API_TOKEN = '  secret-token\n';
        assert.equal((await GET(req('secret-token'))).status, 200);
    });

    test('reports which providers are configured and the order they are tried in', async () => {
        const res = await GET(req('secret-token'));
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.deepEqual(body.configured, { anthropic: false, gemini: true, groq: true });
        assert.deepEqual(body.chain, ['gemini', 'groq']);
        assert.equal(body.expectedEnvNames.gemini, 'GOOGLE_GEMINI_API_KEY');
    });

    test('ACTIVE_AI_PROVIDER changes the primary', async () => {
        process.env.ACTIVE_AI_PROVIDER = 'groq';
        const body = await (await GET(req('secret-token'))).json();
        assert.deepEqual(body.chain, ['groq', 'gemini']);
        assert.equal(body.activeProvider, 'groq');
    });

    test('probe=1 reports model lists and the outcome of a real call, without leaking keys', async () => {
        const realFetch = globalThis.fetch;
        const seen: Array<{ url: string; key: string | null }> = [];
        globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
            const u = String(url);
            const h = new Headers(init?.headers);
            seen.push({ url: u, key: h.get('x-goog-api-key') ?? h.get('authorization') });
            if (u.includes('generativelanguage') && u.includes('/models?')) {
                return new Response(JSON.stringify({ models: [
                    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
                    { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
                ] }), { status: 200 });
            }
            if (u.includes('generativelanguage')) {
                return new Response('{"error":{"message":"models/gemini-2.0-flash is not found; key AIza-SECRET-VALUE-1234567890"}}', { status: 404 });
            }
            if (u.endsWith('/models')) return new Response(JSON.stringify({ data: [{ id: 'llama-x' }] }), { status: 200 });
            return new Response('{}', { status: 200 });
        }) as typeof fetch;
        try {
            const res = await GET(new Request('http://x/api/internal/providers?probe=1', { headers: { 'x-internal-token': 'secret-token' } }));
            const text = await res.text();
            const body = JSON.parse(text);
            assert.deepEqual(body.probes.gemini.models, ['gemini-2.5-flash']);
            assert.equal(body.probes.gemini.probe.ok, false);
            assert.equal(body.probes.gemini.probe.status, 404);
            assert.deepEqual(body.probes.groq.models, ['llama-x']);
            assert.equal(text.includes('SECRET-VALUE'), false, 'keys are redacted from provider error text');
            assert.ok(seen.every((c) => !c.url.includes('SECRET')), 'keys never appear in a URL');
        } finally {
            globalThis.fetch = realFetch;
        }
    });

    test('without probe=1 no outbound request is made', async () => {
        const realFetch = globalThis.fetch;
        let calls = 0;
        globalThis.fetch = (async () => { calls++; return new Response('{}'); }) as typeof fetch;
        try {
            await GET(req('secret-token'));
            assert.equal(calls, 0);
        } finally {
            globalThis.fetch = realFetch;
        }
    });

    test('never leaks a key value', async () => {
        const text = await (await GET(req('secret-token'))).text();
        assert.equal(text.includes('SECRET-VALUE'), false);
        assert.equal(text.includes('gsk-'), false);
        assert.equal(text.includes('AIza'), false);
    });
});

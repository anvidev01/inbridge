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

    test('never leaks a key value', async () => {
        const text = await (await GET(req('secret-token'))).text();
        assert.equal(text.includes('SECRET-VALUE'), false);
        assert.equal(text.includes('gsk-'), false);
        assert.equal(text.includes('AIza'), false);
    });
});

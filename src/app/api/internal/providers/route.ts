/**
 * GET /api/internal/providers: which LLM providers this deployment can use.
 *
 * For operators: Vercel's environment can't be read from outside, and "is the
 * new key live in the running build?" is otherwise answerable only by waiting
 * for a provider to fail. Returns provider NAMES and booleans, never a key.
 *
 * With ?probe=1 it also asks each configured provider which models its key can
 * use and makes one tiny request with the model currently in effect, so a wrong
 * model id or a rejected key shows up as an exact error instead of a silent
 * failover. Keys travel in headers only (never in a URL) so they cannot end up
 * in an error message.
 *
 * Guarded by the same shared secret as the Go API's /internal routes
 * (INTERNAL_API_TOKEN, X-Internal-Token header). Anyone else gets a plain 404,
 * so the route is not discoverable.
 */

import { timingSafeEqual } from 'node:crypto';
import { API_KEY_ENV, PREFERENCE_ORDER, buildChain, isConfigured } from '../../../../lib/ai/chain';
import { DEFAULT_GEMINI_MODEL, streamGeminiWith } from '../../../../lib/ai/gemini';
import { DEFAULT_FIRST_TOKEN_TIMEOUT_MS } from '../../../../lib/ai/router';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Probing runs real model calls, one after another.
export const maxDuration = 60;

/** Keep operator output short and free of anything that looks like a key. */
function clean(text: string): string {
    return text.replace(/(AIza|gsk_|sk-)[A-Za-z0-9_-]{10,}/g, '[redacted]').replace(/\s+/g, ' ').slice(0, 300);
}

async function getJson(url: string, headers: Record<string, string>): Promise<{ status: number; body: unknown }> {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    const text = await res.text();
    try {
        return { status: res.status, body: JSON.parse(text) };
    } catch {
        return { status: res.status, body: text };
    }
}

interface ProbeResult {
    listStatus?: number;
    /** Models the key can use for generating text. */
    models?: string[];
    modelInUse: string;
    probe?: { ok: boolean; status: number; message?: string };
    error?: string;
}

async function probeGemini(): Promise<ProbeResult> {
    const key = process.env.GOOGLE_GEMINI_API_KEY as string;
    const modelInUse = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const headers = { 'x-goog-api-key': key };
    const out: ProbeResult = { modelInUse };
    try {
        const list = await getJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', headers);
        out.listStatus = list.status;
        const models = (list.body as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> }).models;
        if (Array.isArray(models)) {
            out.models = models
                .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
                .map((m) => String(m.name).replace(/^models\//, ''));
        } else {
            out.error = clean(typeof list.body === 'string' ? list.body : JSON.stringify(list.body));
        }
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelInUse)}:generateContent`,
            {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Say OK.' }] }] }),
                signal: AbortSignal.timeout(15_000),
            },
        );
        out.probe = { ok: res.ok, status: res.status, ...(res.ok ? {} : { message: clean(await res.text()) }) };
    } catch (error) {
        out.error = clean(error instanceof Error ? error.message : String(error));
    }
    return out;
}

interface StreamTest {
    model: string;
    ok: boolean;
    firstTextMs?: number;
    totalMs?: number;
    chars?: number;
    sample?: string;
    error?: string;
}

const MODEL_ID = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Runs a real answer through the app's own Gemini adapter, so thinking models
 * that spend the output budget on reasoning (short or empty answers) show up here
 * rather than in front of a user.
 */
async function testGeminiModels(models: string[], question = 'How do I apply for PM-Kisan?', reply = ''): Promise<StreamTest[]> {
    const results: StreamTest[] = [];
    for (const model of models.filter((m) => MODEL_ID.test(m)).slice(0, 4)) {
        const started = Date.now();
        const test: StreamTest = { model, ok: false };
        try {
            let text = '';
            const stream = streamGeminiWith(model, {
                system: `You are InBridge, a guide to Indian government schemes. Answer in 3 short numbered steps, then one sentence on documents needed.${reply ? ` ${reply}` : ''}`,
                turns: [{ role: 'user', content: question }],
                signal: AbortSignal.timeout(20_000),
            });
            for await (const chunk of stream) {
                if (text === '') test.firstTextMs = Date.now() - started;
                text += chunk;
            }
            test.totalMs = Date.now() - started;
            test.chars = text.length;
            test.sample = text.slice(0, 160).replace(/\s+/g, ' ');
            test.ok = text.length > 150;
        } catch (error) {
            test.error = clean(error instanceof Error ? error.message : String(error));
        }
        results.push(test);
    }
    return results;
}

async function probeGroq(): Promise<ProbeResult> {
    const key = process.env.GROQ_API_KEY as string;
    const modelInUse = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
    const headers = { Authorization: `Bearer ${key}` };
    const out: ProbeResult = { modelInUse };
    try {
        const list = await getJson('https://api.groq.com/openai/v1/models', headers);
        out.listStatus = list.status;
        const data = (list.body as { data?: Array<{ id?: string }> }).data;
        if (Array.isArray(data)) out.models = data.map((m) => String(m.id));
        else out.error = clean(typeof list.body === 'string' ? list.body : JSON.stringify(list.body));
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelInUse, max_tokens: 5, messages: [{ role: 'user', content: 'Say OK.' }] }),
            signal: AbortSignal.timeout(15_000),
        });
        out.probe = { ok: res.ok, status: res.status, ...(res.ok ? {} : { message: clean(await res.text()) }) };
    } catch (error) {
        out.error = clean(error instanceof Error ? error.message : String(error));
    }
    return out;
}

function safeEqual(a: string, b: string): boolean {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(req: Request): Promise<Response> {
    // Trimmed: a value pasted into a dashboard often carries a trailing newline or
    // space, which HTTP clients strip from the header they send.
    const token = process.env.INTERNAL_API_TOKEN?.trim();
    const presented = (req.headers.get('x-internal-token') ?? '').trim();
    if (!token || !safeEqual(presented, token)) {
        return new Response('Not found', { status: 404 });
    }

    const configured = Object.fromEntries(PREFERENCE_ORDER.map((p) => [p, isConfigured(p)]));
    const wantProbe = new URL(req.url).searchParams.get('probe') === '1';
    const params = new URL(req.url).searchParams;
    const candidates = (params.get('gemini_models') ?? '').split(',').filter(Boolean);
    const question = (params.get('q') ?? '').slice(0, 200) || undefined;
    const reply = params.get('reply') === 'hi' ? 'Write your entire reply in Hindi, in Devanagari script.' : params.get('reply') === 'hinglish' ? 'Write your entire reply in Hinglish: Hindi written in Latin script.' : '';
    const probes = wantProbe
        ? {
              ...(isConfigured('gemini')
                  ? { gemini: { ...(await probeGemini()), ...(candidates.length ? { streamTests: await testGeminiModels(candidates, question, reply) } : {}) } }
                  : {}),
              ...(isConfigured('groq') ? { groq: await probeGroq() } : {}),
          }
        : undefined;
    return Response.json(
        {
            // Which build is serving: Vercel sets these; they are what the running code was built from.
            build: {
                commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
                message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.slice(0, 80) ?? null,
                environment: process.env.VERCEL_ENV ?? null,
            },
            // Per-instance health: a crash or an out-of-memory kill shows up as uptime restarting from 0.
            runtime: {
                uptimeS: Math.round(process.uptime()),
                rssMB: Math.round(process.memoryUsage().rss / 1048576),
                heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1048576),
            },
            ...(probes ? { probes } : {}),
            configured,
            expectedEnvNames: API_KEY_ENV,
            activeProvider: process.env.ACTIVE_AI_PROVIDER ?? null,
            // The order requests are tried in, after dropping providers with no key.
            chain: buildChain(),
            models: {
                groq: process.env.GROQ_MODEL ?? null,
                gemini: process.env.GEMINI_MODEL ?? `${DEFAULT_GEMINI_MODEL} (default)`,
                anthropic: process.env.ANTHROPIC_MODEL ?? null,
            },
            firstTokenTimeoutMs: Number(process.env.LLM_FIRST_TOKEN_TIMEOUT_MS) || DEFAULT_FIRST_TOKEN_TIMEOUT_MS,
        },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}

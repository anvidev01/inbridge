/**
 * GET /api/internal/providers: which LLM providers this deployment can use.
 *
 * For operators: Vercel's environment can't be read from outside, and "is the
 * new key live in the running build?" is otherwise answerable only by waiting
 * for a provider to fail. Returns provider NAMES and booleans, never a key.
 *
 * Guarded by the same shared secret as the Go API's /internal routes
 * (INTERNAL_API_TOKEN, X-Internal-Token header). Anyone else gets a plain 404,
 * so the route is not discoverable.
 */

import { timingSafeEqual } from 'node:crypto';
import { API_KEY_ENV, PREFERENCE_ORDER, buildChain, isConfigured } from '../../../../lib/ai/chain';
import { DEFAULT_FIRST_TOKEN_TIMEOUT_MS } from '../../../../lib/ai/router';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    return Response.json(
        {
            configured,
            expectedEnvNames: API_KEY_ENV,
            activeProvider: process.env.ACTIVE_AI_PROVIDER ?? null,
            // The order requests are tried in, after dropping providers with no key.
            chain: buildChain(),
            models: {
                groq: process.env.GROQ_MODEL ?? null,
                gemini: process.env.GEMINI_MODEL ?? null,
                anthropic: process.env.ANTHROPIC_MODEL ?? null,
            },
            firstTokenTimeoutMs: Number(process.env.LLM_FIRST_TOKEN_TIMEOUT_MS) || DEFAULT_FIRST_TOKEN_TIMEOUT_MS,
        },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}

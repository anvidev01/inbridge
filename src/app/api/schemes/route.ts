/**
 * GET /api/schemes?q=&state=&limit= : read-only search over the myScheme
 * snapshot, used by the landing page's live search. Returns at most
 * PROBE_MAX_LIMIT schemes (name, issuer, level, slug, myScheme link) and the
 * total number of matches. Validation is in components/landing/scheme-query.
 */
import { parseProbeParams, probeStates, runProbe } from '@/components/landing/scheme-query';

export const runtime = 'nodejs';

function json(body: unknown, status: number, cache = 'no-store'): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
    });
}

export async function GET(req: Request) {
    try {
        const parsed = parseProbeParams(new URL(req.url).searchParams, probeStates());
        if (!parsed.ok) return json({ error: parsed.error }, 400);
        // The dataset is a fixed snapshot, so identical searches can be cached.
        return json(runProbe(parsed.query), 200, 'public, max-age=300, s-maxage=3600');
    } catch {
        return json({ error: 'Search failed.' }, 500);
    }
}

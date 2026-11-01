/**
 * Input handling and search for GET /api/schemes, the read-only endpoint
 * behind the landing page's live search. SERVER ONLY: it imports the scheme
 * dataset. The parsing functions are pure so they can be unit tested.
 */
import { getFilterOptions, getSchemes, servicesHref } from '@/lib/schemes';
import type { ProbeResponse } from './probe-types';

export const PROBE_MAX_Q = 120;
export const PROBE_DEFAULT_LIMIT = 5;
export const PROBE_MAX_LIMIT = 10;

export interface ProbeQuery {
    q: string;
    state: string | null;
    limit: number;
}

export type ProbeParse = { ok: true; query: ProbeQuery } | { ok: false; error: string };

/**
 * Validates ?q=&state=&limit=. q is trimmed and its whitespace collapsed and
 * must be at most PROBE_MAX_Q characters; state must name a state or union
 * territory in the dataset (any letter case); limit must be a positive whole
 * number and is capped at PROBE_MAX_LIMIT. When no state is given, a state
 * named inside q ("... in Bihar") is moved into the state filter.
 */
export function parseProbeParams(params: URLSearchParams, states: readonly string[]): ProbeParse {
    const rawQ = params.get('q') ?? '';
    const q = rawQ.replace(/\s+/g, ' ').trim();
    if (q.length > PROBE_MAX_Q) return { ok: false, error: `q must be at most ${PROBE_MAX_Q} characters.` };

    const rawState = (params.get('state') ?? '').trim();
    let state: string | null = null;
    if (rawState) {
        state = states.find((s) => s.toLowerCase() === rawState.toLowerCase()) ?? null;
        if (!state) return { ok: false, error: 'state is not a state or union territory in the dataset.' };
    }

    const rawLimit = (params.get('limit') ?? '').trim();
    let limit = PROBE_DEFAULT_LIMIT;
    if (rawLimit) {
        if (!/^\d{1,4}$/.test(rawLimit) || Number(rawLimit) < 1) {
            return { ok: false, error: 'limit must be a whole number from 1.' };
        }
        limit = Math.min(Number(rawLimit), PROBE_MAX_LIMIT);
    }

    if (!state) {
        const found = extractState(q, states);
        return { ok: true, query: { q: found.q, state: found.state, limit } };
    }
    return { ok: true, query: { q, state, limit } };
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds the longest state or union territory named in the text, removes it
 * (with an "in" / "for" / "from" / "of" in front of it) and returns both.
 */
export function extractState(text: string, states: readonly string[]): { q: string; state: string | null } {
    const byLength = [...states].sort((a, b) => b.length - a.length);
    for (const state of byLength) {
        const re = new RegExp(`(^|[\\s,])(?:(?:in|for|from|of)\\s+)?${escapeRegExp(state)}(?=$|[\\s,.?!])`, 'i');
        const m = re.exec(text);
        if (m) {
            const q = (text.slice(0, m.index) + m[1] + text.slice(m.index + m[0].length))
                .replace(/\s+/g, ' ')
                .replace(/\s+([,.?!])/g, '$1')
                .replace(/^[\s,.?!]+|[\s,]+$/g, '')
                .trim();
            return { q, state };
        }
    }
    return { q: text, state: null };
}

/** States and union territories in the dataset, as filter values. */
export function probeStates(): string[] {
    return getFilterOptions().states.map((s) => s.value);
}

/** Runs a validated query against the dataset. An empty query returns nothing. */
export function runProbe({ q, state, limit }: ProbeQuery): ProbeResponse {
    const href = servicesHref({ q: q || undefined, state: state ?? undefined });
    if (!q && !state) return { q, state, total: 0, queryTooGeneral: false, items: [], href };
    const page = getSchemes({ q: q || undefined, state: state ?? undefined });
    return {
        q,
        state,
        total: page.total,
        queryTooGeneral: page.queryTooGeneral,
        items: page.items.slice(0, limit).map((s) => ({
            name: s.name,
            issuer: s.issuer,
            level: s.level,
            slug: s.slug,
            source: s.source,
        })),
        href,
    };
}

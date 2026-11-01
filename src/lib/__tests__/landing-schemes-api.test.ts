import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    PROBE_DEFAULT_LIMIT,
    PROBE_MAX_LIMIT,
    PROBE_MAX_Q,
    extractState,
    parseProbeParams,
} from '../../components/landing/scheme-query';

const STATES = ['Bihar', 'Jammu and Kashmir', 'Kerala', 'Tamil Nadu'];
const parse = (qs: string) => parseProbeParams(new URLSearchParams(qs), STATES);

describe('parseProbeParams', () => {
    test('defaults: empty query, no state, default limit', () => {
        assert.deepEqual(parse(''), { ok: true, query: { q: '', state: null, limit: PROBE_DEFAULT_LIMIT } });
    });

    test('trims and collapses whitespace in q', () => {
        const r = parse('q=%20%20farmer%20%20%20loan%20');
        assert.ok(r.ok);
        assert.equal(r.query.q, 'farmer loan');
    });

    test('rejects q longer than the cap', () => {
        const r = parse(`q=${'a'.repeat(PROBE_MAX_Q + 1)}`);
        assert.equal(r.ok, false);
    });

    test('accepts q exactly at the cap', () => {
        const r = parse(`q=${'a'.repeat(PROBE_MAX_Q)}`);
        assert.ok(r.ok);
    });

    test('state must be a known state, matched in any case', () => {
        const ok = parse('q=scholarship&state=bihar');
        assert.ok(ok.ok);
        assert.equal(ok.query.state, 'Bihar');
        assert.equal(parse('state=Atlantis').ok, false);
    });

    test('limit: whole numbers only, at least 1, capped', () => {
        assert.equal(parse('limit=0').ok, false);
        assert.equal(parse('limit=-3').ok, false);
        assert.equal(parse('limit=2.5').ok, false);
        assert.equal(parse('limit=abc').ok, false);
        assert.equal(parse('limit=99999').ok, false);
        const capped = parse('limit=500');
        assert.ok(capped.ok);
        assert.equal(capped.query.limit, PROBE_MAX_LIMIT);
        const three = parse('limit=3');
        assert.ok(three.ok);
        assert.equal(three.query.limit, 3);
    });

    test('a state named in q becomes the state filter when none is given', () => {
        const r = parse('q=scholarship%20for%20girls%20in%20Bihar');
        assert.ok(r.ok);
        assert.deepEqual(r.query, { q: 'scholarship for girls', state: 'Bihar', limit: PROBE_DEFAULT_LIMIT });
    });

    test('an explicit state wins and q is left as typed', () => {
        const r = parse('q=schemes%20in%20Kerala&state=Bihar');
        assert.ok(r.ok);
        assert.deepEqual(r.query, { q: 'schemes in Kerala', state: 'Bihar', limit: PROBE_DEFAULT_LIMIT });
    });
});

describe('extractState', () => {
    test('prefers the longest name and removes its preposition', () => {
        assert.deepEqual(extractState('farm loan for Jammu and Kashmir?', STATES), { q: 'farm loan?', state: 'Jammu and Kashmir' });
    });

    test('matches whole names only', () => {
        assert.deepEqual(extractState('keralaa pension', STATES), { q: 'keralaa pension', state: null });
    });

    test('a bare state name leaves an empty query', () => {
        assert.deepEqual(extractState('Tamil Nadu', STATES), { q: '', state: 'Tamil Nadu' });
    });
});

describe('GET /api/schemes', () => {
    async function get(qs: string) {
        const { GET } = await import('../../app/api/schemes/route');
        return GET(new Request(`http://localhost/api/schemes?${qs}`));
    }

    test('400 with a message for bad input', async () => {
        const res = await get('limit=0');
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(typeof body.error, 'string');
    });

    test('returns at most the capped number of real schemes with only public fields', async () => {
        const res = await get('q=scholarship&limit=50');
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(body.total > PROBE_MAX_LIMIT);
        assert.equal(body.items.length, PROBE_MAX_LIMIT);
        for (const item of body.items) {
            assert.deepEqual(Object.keys(item).sort(), ['issuer', 'level', 'name', 'slug', 'source']);
        }
        assert.match(res.headers.get('cache-control') ?? '', /max-age/);
    });

    test('moves a named state into the filter and links to the directory', async () => {
        const res = await get('q=scholarship%20for%20girls%20in%20Bihar');
        const body = await res.json();
        assert.equal(body.state, 'Bihar');
        assert.equal(body.q, 'scholarship for girls');
        assert.ok(body.total > 0);
        assert.equal(body.href, '/services?q=scholarship+for+girls&state=Bihar');
    });

    test('an empty query returns nothing rather than the whole dataset', async () => {
        const body = await (await get('q=')).json();
        assert.equal(body.total, 0);
        assert.deepEqual(body.items, []);
    });
});

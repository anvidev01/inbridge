import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RAGEngine, type RetrievedContext } from '../rag-engine';

interface Doc { title: string; url: string; content: string }

const thin = (title: string, url = `https://www.myscheme.gov.in/schemes/${title.length}`): Doc => ({
    title, url, content: `${title}\n\nShort summary.\n\nISSUING BODY: A Ministry\nOFFICIAL PAGE: ${url}`,
});
const curated: Doc = {
    title: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)',
    url: 'https://www.myscheme.gov.in/schemes/pm-kisan',
    content: 'PM-KISAN gives Rs 6000.\n\nELIGIBILITY:\n- farmers\n\nREQUIRED DOCUMENTS:\n- Aadhaar\n\nAPPLICATION PROCESS:\n1. Register at CSC\n\nOFFICIAL PORTAL: https://pmkisan.gov.in',
};
const livePage = (n: number): Doc => ({ title: `Official page ${n}`, url: `https://scholarship.up.gov.in/page${n}`, content: `Steps on page ${n}` });

interface Engine {
    searchDataset(query: string, focus: string): Promise<Doc[]>;
    searchGovPortals(query: string): Promise<Doc[] | null>;
    retrieveUncached(query: string, options: Record<string, unknown>): Promise<RetrievedContext>;
}

function engine(dataset: Doc[], live: Doc[] | null) {
    const e = new RAGEngine() as unknown as Engine;
    const calls = { dataset: 0, live: [] as string[] };
    e.searchDataset = async () => { calls.dataset++; return dataset; };
    e.searchGovPortals = async (q: string) => { calls.live.push(q); return live; };
    return { e, calls };
}

const run = (e: Engine, query: string, options: Record<string, unknown> = {}) =>
    e.retrieveUncached(query, { focus: 'all', ...options });

describe('live search of the official sites when the dataset cannot answer', () => {
    beforeEach(() => { /* each test builds its own engine */ });

    test('the dataset answers on its own when it has what was asked: no live search', async () => {
        const { e, calls } = engine([curated], [livePage(1)]);
        const r = await run(e, 'PM-Kisan', { intentText: 'How do I apply for PM-Kisan?' });
        assert.equal(r.source, 'vector_store');
        assert.deepEqual(r.docs.map((d) => d.title), [curated.title]);
        assert.equal(calls.live.length, 0);
    });

    test('a plain "what is" about a scheme in the snapshot stays on the snapshot', async () => {
        const { e, calls } = engine([thin('Atal Pension Yojana')], [livePage(1)]);
        const r = await run(e, 'Atal Pension Yojana', { intentText: 'Tell me about Atal Pension Yojana' });
        assert.equal(r.source, 'vector_store');
        assert.equal(calls.live.length, 0);
    });

    test('steps asked for a scheme whose entry has none: live search, scheme entry first', async () => {
        const entry = thin('Post-matric Scholarship Scheme- Uttar Pradesh');
        const { e, calls } = engine([entry], [livePage(1), livePage(2)]);
        const r = await run(e, 'Uttar Pradesh scholarship', {
            intentText: 'How do I apply for UP scholarship?',
            liveQuery: 'How do I apply for Uttar Pradesh scholarship?',
        });
        assert.equal(r.source, 'tavily_search');
        assert.deepEqual(r.docs.map((d) => d.title), [entry.title, 'Official page 1', 'Official page 2']);
        assert.deepEqual(calls.live, ['How do I apply for Uttar Pradesh scholarship?'], 'the live query keeps the word "apply"');
    });

    test('a subject the snapshot does not have: live pages only, irrelevant entries are dropped', async () => {
        const { e } = engine([thin('Savitribai Phule Kishori Samriddhi Yojana'), thin('Samriddhi Scheme for SC Students')], [livePage(1)]);
        const r = await run(e, 'Sukanya Samriddhi', { intentText: 'What is the Sukanya Samriddhi scheme?' });
        assert.equal(r.source, 'tavily_search');
        assert.deepEqual(r.docs.map((d) => d.title), ['Official page 1']);
    });

    test('the dataset finds nothing at all: live search', async () => {
        const { e } = engine([], [livePage(1)]);
        const r = await run(e, 'PAN card', { intentText: 'How do I get a PAN card?' });
        assert.equal(r.source, 'tavily_search');
        assert.equal(r.docs.length, 1);
    });

    test('checking a status always needs the live sites, even for a scheme with full details', async () => {
        const { e, calls } = engine([curated], [livePage(1)]);
        const r = await run(e, 'PM-Kisan', { intentText: 'How do I check my PM Kisan status?' });
        assert.equal(r.source, 'tavily_search');
        assert.equal(calls.live.length, 1);
        assert.equal(r.docs[0].title, curated.title);
    });

    test('a page that is also a dataset entry is not listed twice', async () => {
        const entry = thin('Post-matric Scholarship Scheme- Uttar Pradesh', 'https://www.myscheme.gov.in/schemes/mpss');
        const { e } = engine([entry], [{ title: 'Same page again', url: entry.url, content: 'x' }, livePage(2)]);
        const r = await run(e, 'Uttar Pradesh scholarship', { intentText: 'how do I apply' });
        assert.equal(r.docs.filter((d) => d.url === entry.url).length, 1);
    });

    test('live search finds nothing: fall back to the relevant dataset entry', async () => {
        const entry = thin('Post-matric Scholarship Scheme- Uttar Pradesh');
        const { e } = engine([entry], null);
        const r = await run(e, 'Uttar Pradesh scholarship', { intentText: 'How do I apply?' });
        assert.equal(r.source, 'vector_store');
        assert.deepEqual(r.docs.map((d) => d.title), [entry.title]);
    });

    test('live search finds nothing and nothing in the dataset is relevant: no sources, never misleading ones', async () => {
        const { e } = engine([thin('Savitribai Phule Kishori Samriddhi Yojana')], null);
        const r = await run(e, 'Sukanya Samriddhi', { intentText: 'What is the Sukanya Samriddhi scheme?' });
        assert.equal(r.source, 'llm_direct');
        assert.deepEqual(r.docs, []);
    });

    test('recency questions still go to live search first', async () => {
        const { e, calls } = engine([curated], [livePage(1)]);
        const r = await run(e, 'PM-Kisan', { recencyText: 'latest PM Kisan installment 2026', intentText: 'latest PM Kisan installment 2026' });
        assert.equal(r.source, 'tavily_search');
        assert.equal(calls.dataset, 0, 'live results were enough, the dataset was not even searched');
    });
});

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildSources } from '../ai/citations';
import { displayHost } from '../ai/gov-url';
import { buildSystemPrompt, formatContextBlocks } from '../ai/system-prompt';
import { categoryLine, matchesFocus } from '../rag-engine';

describe('buildSources', () => {
    test('numbers sources from 1, strips www and flags official hosts', () => {
        const { citations, promptSources } = buildSources([
            { title: 'PM-KISAN', url: 'https://www.myscheme.gov.in/schemes/pm-kisan', content: 'Farmer support.' },
            { title: 'News', url: 'https://example.com/pm-kisan', content: 'Third-party page.' },
        ]);
        assert.deepEqual(citations, [
            { n: 1, title: 'PM-KISAN', url: 'https://www.myscheme.gov.in/schemes/pm-kisan', host: 'myscheme.gov.in', official: true },
            { n: 2, title: 'News', url: 'https://example.com/pm-kisan', host: 'example.com', official: false },
        ]);
        assert.deepEqual(promptSources.map((s) => s.n), [1, 2]);
    });

    test('drops docs without a usable URL or content and duplicate URLs, keeping numbering dense', () => {
        const { citations } = buildSources([
            { title: 'No URL', url: '', content: 'x' },
            { title: 'Bad scheme', url: 'javascript:alert(1)', content: 'x' },
            { title: 'A', url: 'https://pmkisan.gov.in/', content: 'a' },
            { title: 'A again', url: 'https://pmkisan.gov.in/', content: 'a' },
            { title: 'Empty', url: 'https://uidai.gov.in/', content: '   ' },
            { title: '', url: 'https://dbtbharat.nic.in/x', content: 'b' },
        ]);
        assert.deepEqual(citations.map((c) => [c.n, c.title, c.host]), [
            [1, 'A', 'pmkisan.gov.in'],
            [2, 'dbtbharat.nic.in', 'dbtbharat.nic.in'],
        ]);
    });

    test('look-alike hosts are not official', () => {
        const { citations } = buildSources([{ title: 't', url: 'https://gov.in.example.com/', content: 'c' }]);
        assert.equal(citations[0].official, false);
    });
});

describe('displayHost', () => {
    test('returns null for non-http URLs', () => {
        assert.equal(displayHost('ftp://x.gov.in'), null);
        assert.equal(displayHost('not a url'), null);
        assert.equal(displayHost('https://WWW.India.gov.in/a'), 'india.gov.in');
    });
});

describe('system prompt', () => {
    const sources = [{ n: 1, title: 'PM-KISAN', url: 'https://pmkisan.gov.in', content: 'Rs 6000 per year.' }];

    test('context blocks carry the same numbers as the citations', () => {
        assert.equal(formatContextBlocks(sources), '[1] PM-KISAN\nURL: https://pmkisan.gov.in\nRs 6000 per year.');
        const prompt = buildSystemPrompt({ language: 'en', mode: 'default', focus: 'all', sources });
        assert.match(prompt, /Only use numbers 1 to 1\./);
        assert.match(prompt, /---FOLLOWUPS---/);
        assert.doesNotMatch(prompt, /---SOURCES---/);
    });

    test('never claims to be official', () => {
        for (const mode of ['default', 'grievance'] as const) {
            const prompt = buildSystemPrompt({ language: 'en', mode, focus: 'all', sources: [] });
            assert.doesNotMatch(prompt, /official (Government of India|government assistant)|verified by|MeitY|NIC\b/i);
            assert.match(prompt, /not a government website/i);
        }
    });

    test('empty context points to myScheme / india.gov.in and forbids citations', () => {
        const prompt = buildSystemPrompt({ language: 'hi', mode: 'default', focus: 'all', sources: [] });
        assert.match(prompt, /myscheme\.gov\.in/);
        assert.match(prompt, /Do not use citation markers/);
        assert.match(prompt, /Devanagari/);
    });

    test('grievance mode drafts for CPGRAMS and says InBridge does not file it', () => {
        const prompt = buildSystemPrompt({ language: 'en', mode: 'grievance', focus: 'all', sources: [] });
        assert.match(prompt, /https:\/\/pgportal\.gov\.in/);
        assert.match(prompt, /InBridge does not file this complaint/);
    });

    test('focus is named in the prompt only when set', () => {
        const focused = buildSystemPrompt({ language: 'en', mode: 'default', focus: 'Health & Wellness', sources });
        assert.match(focused, /"Health & Wellness"/);
        const all = buildSystemPrompt({ language: 'en', mode: 'default', focus: 'all', sources });
        assert.doesNotMatch(all, /TOPIC/);
    });
});

describe('focus filter on docstore pageContent', () => {
    const doc = 'Some scheme\n\nISSUING BODY: Ministry\nCATEGORY: Agriculture,Rural & Environment, Business & Entrepreneurship\nLEVEL: Central';

    test('reads the CATEGORY line', () => {
        assert.equal(categoryLine(doc), 'Agriculture,Rural & Environment, Business & Entrepreneurship');
        assert.equal(categoryLine('no category here'), null);
    });

    test('matches any listed category, including names containing commas', () => {
        assert.ok(matchesFocus(doc, 'Agriculture,Rural & Environment'));
        assert.ok(matchesFocus(doc, 'Business & Entrepreneurship'));
        assert.ok(!matchesFocus(doc, 'Health & Wellness'));
        assert.ok(matchesFocus(doc, 'all'));
        assert.ok(!matchesFocus('no category', 'Health & Wellness'));
    });
});

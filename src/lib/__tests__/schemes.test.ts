import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
    parseList,
    normaliseScheme,
    buildIndex,
    searchIndex,
    computeStats,
    computeFilterOptions,
    parseSchemeFilters,
    servicesHref,
    categoryLabel,
    getSchemes,
    getScheme,
    getStats,
    getFilterOptions,
    getRelatedSchemes,
    fold,
    queryTerms,
    nameSortKey,
    rankRelated,
    type Scheme,
} from '../schemes';
import { pngSize } from '../site';

const FIXTURE = [
    {
        slug: 'pm-kisan', name: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)', short: 'PM-KISAN',
        issuer: 'Ministry Of Agriculture and Farmers Welfare', level: 'Central', states: ['All'],
        categories: ['Agriculture,Rural & Environment'], for: 'Family',
        brief: 'Income support to landholding farmer families.', tags: ['Farmers', 'Income Support'],
        source: 'https://www.myscheme.gov.in/schemes/pm-kisan',
    },
    {
        // Stringified Python lists, as older scraper.py output stored them.
        slug: 'uk-ambulance', name: '108 Emergency Ambulance Service - Uttarakhand', short: '108EASUK',
        issuer: 'Government of Uttarakhand', level: 'State', states: "['Uttarakhand']",
        categories: "['Health & Wellness']", for: 'Individual',
        brief: 'Free state-wide ambulance service.', tags: "['Ambulance', \"Children's Health\"]",
        source: 'https://www.myscheme.gov.in/schemes/108easuk',
    },
    {
        slug: 'gj-scholar', name: 'Girls Scholarship Scheme', short: 'GSS',
        issuer: 'Government of Gujarat', level: 'State', states: ['Gujarat'],
        categories: ['Education & Learning'], for: '#N/A',
        brief: 'Scholarship for girl students in Gujarat.', tags: ['Scholarship', 'Girl'],
        source: 'http://example.com/not-myscheme',
    },
    {
        slug: 'ne-central', name: 'North East Farmer Support', short: 'NEFS',
        issuer: 'Ministry of DoNER', level: 'Central', states: ['Assam', 'Tripura'],
        categories: ['Agriculture,Rural & Environment'], for: null,
        brief: 'Support for farmers in the north-east.', tags: ['Farmers'],
        source: 'https://www.myscheme.gov.in/schemes/ne-central',
    },
    { slug: '', name: 'No slug — dropped' },
    { slug: 'pm-kisan', name: 'Duplicate slug — dropped' },
];

describe('parseList', () => {
    test('passes real arrays through, trimmed and de-duplicated', () => {
        assert.deepEqual(parseList([' Goa ', 'Goa', '', 'Delhi']), ['Goa', 'Delhi']);
    });

    test('parses stringified JSON and Python lists, including apostrophes', () => {
        assert.deepEqual(parseList('["Assam","Tripura"]'), ['Assam', 'Tripura']);
        assert.deepEqual(parseList("['Uttarakhand']"), ['Uttarakhand']);
        assert.deepEqual(parseList("['Women\\'s Welfare', \"Children's Day\"]"), ["Women's Welfare", "Children's Day"]);
        assert.deepEqual(parseList('[]'), []);
    });

    test('never splits a plain string on commas', () => {
        assert.deepEqual(parseList('Banking,Financial Services and Insurance'), ['Banking,Financial Services and Insurance']);
    });

    test('returns [] for null and non-list values', () => {
        assert.deepEqual(parseList(null), []);
        assert.deepEqual(parseList(42), []);
    });
});

describe('normaliseScheme', () => {
    test('splits the "All" marker out of states and normalises audience and source', () => {
        const kisan = normaliseScheme(FIXTURE[0])!;
        assert.equal(kisan.allIndia, true);
        assert.deepEqual(kisan.states, []);
        assert.equal(kisan.audience, 'Family');

        const gj = normaliseScheme(FIXTURE[2])!;
        assert.equal(gj.audience, null, "'#N/A' means not stated");
        assert.equal(gj.source, null, 'non-myScheme URLs are not linked');
        assert.equal(normaliseScheme(FIXTURE[3])!.audience, null);
    });

    test('rejects records without slug or name', () => {
        assert.equal(normaliseScheme(FIXTURE[4]), null);
        assert.equal(normaliseScheme(null), null);
    });
});

describe('searchIndex', () => {
    const index = buildIndex(FIXTURE);

    test('drops invalid and duplicate records', () => {
        assert.equal(index.entries.length, 4);
        assert.equal(index.bySlug.get('pm-kisan')!.short, 'PM-KISAN');
    });

    test('text search matches name, short code, tags, issuer and brief', () => {
        assert.deepEqual(searchIndex(index, { q: 'pm kisan' }).items.map((s) => s.slug), ['pm-kisan']);
        assert.deepEqual(searchIndex(index, { q: '108EASUK' }).items.map((s) => s.slug), ['uk-ambulance']);
        assert.deepEqual(searchIndex(index, { q: 'ambulance' }).items.map((s) => s.slug), ['uk-ambulance']);
        assert.deepEqual(searchIndex(index, { q: 'gujarat' }).items.map((s) => s.slug), ['gj-scholar']);
        assert.equal(searchIndex(index, { q: 'nonexistentword' }).total, 0);
    });

    test('stopwords do not exclude results ("schemes for farmers")', () => {
        const slugs = searchIndex(index, { q: 'schemes for farmers' }).items.map((s) => s.slug).sort();
        assert.deepEqual(slugs, ['ne-central', 'pm-kisan']);
    });

    test('state filter includes all-India schemes but not Central schemes limited to other states', () => {
        const gujarat = searchIndex(index, { state: 'Gujarat' }).items.map((s) => s.slug);
        assert.deepEqual(gujarat, ['gj-scholar', 'pm-kisan'], 'state-specific first, then all-India');

        const assam = searchIndex(index, { state: 'Assam' }).items.map((s) => s.slug);
        assert.deepEqual(assam, ['ne-central', 'pm-kisan']);
    });

    test('category, level and audience filters combine', () => {
        const agri = searchIndex(index, { category: 'Agriculture,Rural & Environment', level: 'Central' });
        assert.equal(agri.total, 2);
        assert.equal(searchIndex(index, { level: 'State' }).total, 2);
        assert.deepEqual(searchIndex(index, { audience: 'Family' }).items.map((s) => s.slug), ['pm-kisan']);
    });

    test('pagination clamps the page into range', () => {
        const p = searchIndex(index, {}, 99, 3);
        assert.equal(p.totalPages, 2);
        assert.equal(p.page, 2);
        assert.equal(p.items.length, 1);
        assert.equal(searchIndex(index, {}, -5, 3).page, 1);
        assert.equal(searchIndex(index, { q: 'zzzz' }).totalPages, 1);
    });
});

describe('Devanagari and unusable queries', () => {
    const index = buildIndex([
        ...FIXTURE,
        {
            slug: 'hi-kisan', name: 'किसान सम्मान योजना', short: 'HIKS', issuer: 'Government of Bihar',
            level: 'State', states: ['Bihar'], categories: ['Agriculture,Rural & Environment'], for: 'Individual',
            brief: 'किसानों के लिए सहायता', tags: ['किसान'], source: null,
        },
        {
            slug: 'hi-scholar', name: 'छात्रवृत्ति योजना', short: 'HISC', issuer: 'Government of Bihar',
            level: 'State', states: ['Bihar'], categories: ['Education & Learning'], for: 'Individual',
            brief: 'छात्रों के लिए छात्रवृत्ति', tags: ['छात्रवृत्ति'], source: null,
        },
    ]);

    test('fold keeps Devanagari vowel signs, virama and anusvara', () => {
        assert.equal(fold('किसान'), 'किसान');
        assert.equal(fold('छात्रवृत्ति योजना'), 'छात्रवृत्ति योजना');
        assert.equal(fold('Café, “Ārogya”!'), 'cafe arogya');
    });

    test('a Devanagari query matches only schemes containing the word', () => {
        assert.deepEqual(searchIndex(index, { q: 'किसान' }).items.map((s) => s.slug), ['hi-kisan']);
        assert.deepEqual(searchIndex(index, { q: 'छात्रवृत्ति' }).items.map((s) => s.slug), ['hi-scholar']);
        assert.equal(searchIndex(index, { q: 'किसान' }).queryTooGeneral, false);
    });

    test('single-letter and stopword-only queries return nothing and are flagged, not the whole dataset', () => {
        for (const q of ['a', 'the', 'schemes for me', 'योजना']) {
            const page = searchIndex(index, { q });
            assert.equal(page.total, 0, q);
            assert.equal(page.queryTooGeneral, true, q);
            assert.deepEqual(queryTerms(q), [], q);
        }
    });

    test('no query (or whitespace) still lists everything and is not flagged', () => {
        assert.equal(searchIndex(index, {}).total, 6);
        assert.equal(searchIndex(index, { q: '   ' }).total, 6);
        assert.equal(searchIndex(index, {}).queryTooGeneral, false);
    });

    test('real dataset: Hindi and stopword queries do not return everything', () => {
        const all = getStats().total;
        for (const q of ['किसान', 'छात्रवृत्ति', 'a', 'the']) {
            assert.ok(getSchemes({ q }).total < all, q);
        }
        assert.equal(getSchemes({ q: 'the' }).queryTooGeneral, true);
        assert.equal(getSchemes({ q: 'a' }).total, 0);
    });
});

describe('related schemes ("More in <area>")', () => {
    const base = {
        short: '', level: 'State' as const, allIndia: false, audience: null, brief: '', source: null,
        categories: ['Education & Learning'],
    };
    const mk = (slug: string, name: string, issuer: string, states: string[], tags: string[] = []): Scheme =>
        ({ ...base, slug, name, issuer, states, tags });

    const target = mk('t', 'Target Scholarship', 'Government of Bihar', ['Bihar'], ['Scholarship']);
    const candidates = [
        mk('quoted', '"Zebra" Scheme', 'Government of Kerala', ['Kerala']),
        mk('alpha', 'Alpha Grant', 'Government of Goa', ['Goa']),
        mk('bihar-other', 'Zeta Bihar Grant', 'Department of Welfare, Bihar', ['Bihar']),
        mk('bihar-issuer', 'Yellow Bihar Scheme', 'Government of Bihar', ['Bihar']),
        mk('bihar-tag', 'Xylo Bihar Scholarship', 'Department of Welfare, Bihar', ['Bihar'], ['Scholarship']),
        { ...mk('other-area', 'Aaa Health', 'Government of Bihar', ['Bihar']), categories: ['Health & Wellness'] },
        target,
    ];

    test('same issuer, then same state, then shared tags, then name', () => {
        assert.deepEqual(
            rankRelated(target, candidates, 10).map((s) => s.slug),
            ['bihar-issuer', 'bihar-tag', 'bihar-other', 'alpha', 'quoted']
        );
    });

    test('names sort ignoring leading quotes and punctuation', () => {
        assert.equal(nameSortKey('"Aarambh" Scheme'), 'Aarambh" Scheme');
        assert.equal(nameSortKey('“Mukhyamantri” Yojana'), 'Mukhyamantri” Yojana');
        const ordered = rankRelated(mk('x', 'X', '', []), candidates.filter((c) => c.states[0] !== 'Bihar'), 10);
        assert.deepEqual(ordered.map((s) => s.slug), ['alpha', 'quoted']);
    });

    test('real dataset: related list excludes the scheme and stays in its area', () => {
        const scheme = getScheme('pm-kisan')!;
        const related = getRelatedSchemes(scheme);
        assert.ok(related.length > 0 && related.length <= 3);
        for (const r of related) {
            assert.notEqual(r.slug, scheme.slug);
            assert.ok(r.categories.includes(scheme.categories[0]));
        }
    });
});

describe('pngSize', () => {
    test('reads width and height from the IHDR chunk of a real PNG', () => {
        const bytes = readFileSync(path.join(process.cwd(), 'public/icon-192.png'));
        assert.deepEqual(pngSize(bytes), { width: 192, height: 192 });
        assert.deepEqual(pngSize(readFileSync(path.join(process.cwd(), 'public/logo.png'))), { width: 605, height: 592 });
    });

    test('returns null for non-PNG bytes', () => {
        assert.equal(pngSize(new Uint8Array([1, 2, 3])), null);
        assert.equal(pngSize(readFileSync(path.join(process.cwd(), 'public/logo.jpg'))), null);
    });
});

describe('stats and filter options', () => {
    const schemes = buildIndex(FIXTURE).entries.map((e) => e.scheme);

    test('computeStats counts from the data', () => {
        assert.deepEqual(computeStats(schemes), {
            total: 4, central: 2, state: 2, categories: 3, states: 4, issuers: 4,
        });
    });

    test('parseSchemeFilters drops unknown values and reads "for" as audience', () => {
        const options = computeFilterOptions(schemes);
        const { filters, page } = parseSchemeFilters(
            { q: ' kisan ', state: 'Atlantis', category: 'Education & Learning', level: 'Federal', for: 'Family', page: '3' },
            options
        );
        assert.deepEqual(filters, { q: 'kisan', state: undefined, category: 'Education & Learning', level: undefined, audience: 'Family' });
        assert.equal(page, 3);
        assert.equal(parseSchemeFilters({ page: 'abc' }, options).page, 1);
    });

    test('servicesHref round-trips filters', () => {
        assert.equal(servicesHref({}), '/services');
        assert.equal(
            servicesHref({ q: 'a b', state: 'Tamil Nadu', audience: 'Family' }, 2),
            '/services?q=a+b&state=Tamil+Nadu&for=Family&page=2'
        );
    });

    test('categoryLabel adds the missing space after commas', () => {
        assert.equal(categoryLabel('Banking,Financial Services and Insurance'), 'Banking, Financial Services and Insurance');
        assert.equal(categoryLabel('Science, IT & Communications'), 'Science, IT & Communications');
    });
});

describe('real dataset (scripts/scraper/data/myscheme_schemes.json)', () => {
    const raw = JSON.parse(
        readFileSync(path.join(process.cwd(), 'scripts/scraper/data/myscheme_schemes.json'), 'utf8')
    ) as unknown[];

    test('stats are computed from the file, not hard-coded', () => {
        const stats = getStats();
        assert.equal(stats.total, raw.length);
        assert.equal(stats.central + stats.state, stats.total);
        assert.ok(stats.categories > 0 && stats.states > 0);
    });

    test('getScheme finds pm-kisan and nothing for non-scheme slugs', () => {
        assert.equal(getScheme('pm-kisan')?.short, 'PM-KISAN');
        assert.equal(getScheme('aadhaar'), undefined);
    });

    test('a PM-KISAN search ranks the scheme first', () => {
        assert.equal(getSchemes({ q: 'PM-KISAN' }).items[0]?.slug, 'pm-kisan');
    });

    test('the first page is full and filter options cover every category', () => {
        const page = getSchemes({}, 1);
        assert.equal(page.items.length, 20);
        assert.equal(getFilterOptions().categories.length, getStats().categories);
    });
});

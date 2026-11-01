/**
 * Scheme directory data: loads scripts/scraper/data/myscheme_schemes.json
 * once per server process, normalises it, and answers search / filter / count
 * queries for /, /services and /services/[slug].
 *
 * SERVER ONLY. The dataset is ~3 MB; import this module only from server
 * components or route handlers so it never reaches a client bundle. (The
 * `server-only` package is not installed, so this is enforced by convention.)
 *
 * The JSON is imported statically (not read with fs) so Next's file tracing
 * ships it with every route that uses it, with no next.config changes.
 *
 * The dataset has NO eligibility fields (age, income, caste, gender). Results
 * are "may be relevant" matches on state / category / level / audience only;
 * never present them as eligibility.
 */
import rawDataset from '../../scripts/scraper/data/myscheme_schemes.json';

// ── Types ─────────────────────────────────────────────────────────────────

export type SchemeLevel = 'Central' | 'State';

export interface Scheme {
    slug: string;
    name: string;
    /** Short code from myScheme, e.g. "PM-KISAN". May equal the slug in upper case. */
    short: string;
    issuer: string;
    level: SchemeLevel;
    /** States / UTs the scheme lists. Never contains the "All" marker. */
    states: string[];
    /** True when myScheme lists the scheme for "All" states (all-India). */
    allIndia: boolean;
    /** Raw myScheme category strings (also the filter keys). */
    categories: string[];
    /** myScheme "scheme for" value: Individual / Family / Infra, or null when absent. */
    audience: string | null;
    brief: string;
    tags: string[];
    /** myScheme page URL; null if the record's URL was not on myscheme.gov.in. */
    source: string | null;
}

export interface SchemeFilters {
    q?: string;
    state?: string;
    category?: string;
    level?: SchemeLevel;
    audience?: string;
}

export interface SchemePage {
    items: Scheme[];
    total: number;
    /** 1-based, clamped to [1, totalPages]. */
    page: number;
    pageSize: number;
    totalPages: number;
    /**
     * True when a search was given but held no usable words (only stopwords
     * such as "the" or "schemes", or single letters). The result is then
     * empty rather than the whole dataset, and the UI should say why.
     */
    queryTooGeneral: boolean;
}

export interface SchemeStats {
    total: number;
    central: number;
    state: number;
    /** Distinct myScheme categories. */
    categories: number;
    /** Distinct states / UTs named by at least one scheme ("All" excluded). */
    states: number;
    /** Distinct issuing ministries / state governments. */
    issuers: number;
}

export interface FilterOption {
    value: string;
    label: string;
    count: number;
}

export interface SchemeFilterOptions {
    states: FilterOption[];
    categories: FilterOption[];
    levels: FilterOption[];
    audiences: FilterOption[];
}

export const PAGE_SIZE = 20;

/** Shown wherever dataset facts appear. The JSON was committed on 2026-08-30 (9e12a38). */
export const DATASET_LABEL = 'myScheme snapshot, Aug 2026';
/** The month the snapshot was taken, for sentences ("a snapshot taken in August 2026"). */
export const DATASET_MONTH = 'August 2026';

const ALL_STATES_MARKER = 'all';
const MYSCHEME_PREFIX = 'https://www.myscheme.gov.in/';

/** Display labels for the myScheme "scheme for" values. Unknown values show as-is. */
const AUDIENCE_LABELS: Record<string, string> = {
    Individual: 'Individuals',
    Family: 'Families',
    Infra: 'Institutions & infrastructure',
};

// ── Parsing / normalisation ───────────────────────────────────────────────

/**
 * Parses a Python-style list literal such as "['Uttarakhand', \"Children's Day\"]".
 * Handles single or double quotes, backslash escapes, and apostrophes inside
 * double-quoted items. Returns null if the text is not a list literal.
 */
function parsePythonList(text: string): string[] | null {
    const s = text.trim();
    if (!s.startsWith('[') || !s.endsWith(']')) return null;

    const out: string[] = [];
    let i = 1;
    const end = s.length - 1;
    while (i < end) {
        const ch = s[i];
        if (ch === ',' || /\s/.test(ch)) { i++; continue; }
        if (ch !== "'" && ch !== '"') {
            // Bare token (e.g. None, numbers): read up to the next comma.
            const next = s.indexOf(',', i);
            const token = s.slice(i, next === -1 ? end : next).trim();
            if (token && token !== 'None') out.push(token);
            i = next === -1 ? end : next + 1;
            continue;
        }
        const quote = ch;
        let value = '';
        i++;
        while (i < end && s[i] !== quote) {
            if (s[i] === '\\' && i + 1 < end) { value += s[i + 1]; i += 2; continue; }
            value += s[i];
            i++;
        }
        if (i >= end) return null; // unterminated string
        out.push(value);
        i++; // closing quote
    }
    return out;
}

/**
 * Coerces a dataset list field to string[]. The current JSON already has real
 * arrays, but older scraper.py output stored them as stringified Python lists,
 * so both shapes (and a stringified list nested inside an array) are accepted.
 * A plain string that is not a list literal is one item. Never split on
 * commas, because category names contain commas ("Banking,Financial ...").
 */
export function parseList(value: unknown): string[] {
    let items: string[];
    if (Array.isArray(value)) {
        items = value.flatMap((v) => (typeof v === 'string' ? parseList(v) : []));
    } else if (typeof value === 'string') {
        const s = value.trim();
        if (!s) return [];
        if (s.startsWith('[') && s.endsWith(']')) {
            let parsed: unknown = null;
            try { parsed = JSON.parse(s); } catch { parsed = parsePythonList(s); }
            items = Array.isArray(parsed)
                ? parsed.filter((v): v is string => typeof v === 'string')
                : [s];
        } else {
            items = [s];
        }
    } else {
        return [];
    }
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of items) {
        const t = item.trim();
        if (t && !seen.has(t)) { seen.add(t); out.push(t); }
    }
    return out;
}

function str(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * Display text without em dashes: the site sets none, so a dash in the source
 * text (and the spaces around it) becomes a comma. Only names and briefs pass
 * through here; slugs, URLs and filter keys are left exactly as in the data.
 */
export function withoutEmDashes(text: string): string {
    return text.replace(/\s*\u2014\s*/g, ', ');
}

/** Turns one raw dataset record into a Scheme, or null if it lacks a slug or name. */
export function normaliseScheme(raw: unknown): Scheme | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;

    const slug = str(r.slug);
    const name = str(r.name);
    if (!slug || !name) return null;

    const listedStates = parseList(r.states);
    const allIndia = listedStates.some((s) => s.toLowerCase() === ALL_STATES_MARKER);
    const audienceRaw = str(r.for);
    const source = str(r.source);

    return {
        slug,
        name: withoutEmDashes(name),
        short: str(r.short),
        issuer: str(r.issuer),
        level: str(r.level) === 'Central' ? 'Central' : 'State',
        states: listedStates.filter((s) => s.toLowerCase() !== ALL_STATES_MARKER),
        allIndia,
        categories: parseList(r.categories),
        // '#N/A' and null both mean "not stated" in the source data.
        audience: audienceRaw && audienceRaw !== '#N/A' ? audienceRaw : null,
        brief: withoutEmDashes(str(r.brief)),
        tags: parseList(r.tags),
        source: source.startsWith(MYSCHEME_PREFIX) ? source : null,
    };
}

/**
 * Lower-case, strip Latin diacritics and punctuation, collapse spaces, for
 * matching only. Only U+0300–U+036F (Latin combining accents) are removed;
 * other combining marks (\p{M}) are kept because in Devanagari they are part
 * of the word: vowel signs, virama and anusvara ("किसान", "छात्रवृत्ति").
 */
export function fold(text: string): string {
    return text
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[’‘`']/g, '')
        .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
        .trim();
}

/** "Banking,Financial Services and Insurance" -> "Banking, Financial Services and Insurance". */
export function categoryLabel(category: string): string {
    return category.replace(/,(?=\S)/g, ', ');
}

export function audienceLabel(audience: string): string {
    return AUDIENCE_LABELS[audience] ?? audience;
}

// ── Index ─────────────────────────────────────────────────────────────────

interface IndexedScheme {
    scheme: Scheme;
    name: string;    // folded, space-padded for word-start checks
    short: string;   // folded, spaces removed
    tags: string;
    issuer: string;
    brief: string;
}

export interface SchemeIndex {
    entries: IndexedScheme[];
    bySlug: Map<string, Scheme>;
}

export function buildIndex(raw: unknown): SchemeIndex {
    const list = Array.isArray(raw) ? raw : [];
    const entries: IndexedScheme[] = [];
    const bySlug = new Map<string, Scheme>();
    for (const item of list) {
        const scheme = normaliseScheme(item);
        if (!scheme || bySlug.has(scheme.slug)) continue;
        bySlug.set(scheme.slug, scheme);
        entries.push({
            scheme,
            name: ` ${fold(scheme.name)} `,
            short: fold(scheme.short).replace(/ /g, ''),
            tags: ` ${fold(scheme.tags.join(' '))} `,
            issuer: ` ${fold(scheme.issuer)} `,
            brief: ` ${fold(scheme.brief)} `,
        });
    }
    return { entries, bySlug };
}

// Words that carry no signal in a scheme search ("schemes for farmers").
const STOPWORDS = new Set([
    'a', 'an', 'and', 'the', 'of', 'for', 'in', 'to', 'on', 'by', 'with', 'is', 'are',
    'scheme', 'schemes', 'yojana', 'what', 'which', 'how', 'me', 'my', 'i',
    'योजना', 'योजनाएं', 'योजनाएँ', 'के', 'की', 'का', 'लिए', 'में',
]);

/**
 * Search terms from a query: folded words minus stopwords and single letters.
 * May be empty for a non-empty query ("the", "a", "schemes"); callers must
 * treat that as "nothing to search for", not as "match everything".
 */
export function queryTerms(q: string): string[] {
    return fold(q)
        .split(' ')
        .filter((t) => t.length > 1 || /\d/.test(t))
        .filter((t) => !STOPWORDS.has(t));
}

/**
 * Relevance score for a query; 0 means "does not match". Every term must
 * appear in at least one field (AND). Name and short-code hits outrank tag,
 * issuer and brief hits.
 */
function score(entry: IndexedScheme, terms: string[], phrase: string): number {
    let total = 0;
    for (const term of terms) {
        let best = 0;
        if (entry.short === term) best = 8;
        else if (entry.name.includes(` ${term}`)) best = 6;
        else if (entry.name.includes(term)) best = 4;
        else if (entry.tags.includes(` ${term}`)) best = 3;
        else if (entry.issuer.includes(` ${term}`)) best = 2;
        else if (entry.brief.includes(term) || entry.tags.includes(term) || entry.issuer.includes(term)) best = 1;
        if (best === 0) return 0;
        total += best;
    }
    if (phrase.length > 2) {
        if (entry.short === phrase.replace(/ /g, '')) total += 15;
        if (entry.name.includes(` ${phrase} `)) total += 10;
        else if (entry.name.includes(phrase)) total += 5;
    }
    return total;
}

/** True if the scheme is listed for the state, either by name or as all-India. */
export function appliesToState(scheme: Scheme, state: string): boolean {
    return scheme.allIndia || scheme.states.includes(state);
}

function matchesFilters(s: Scheme, f: SchemeFilters): boolean {
    if (f.level && s.level !== f.level) return false;
    if (f.category && !s.categories.includes(f.category)) return false;
    if (f.audience && s.audience !== f.audience) return false;
    if (f.state && !appliesToState(s, f.state)) return false;
    return true;
}

/** Name for sorting: leading quotes, brackets and other punctuation ignored. */
export function nameSortKey(name: string): string {
    return name.replace(/^[^\p{L}\p{N}]+/u, '');
}

const byName = (a: Scheme, b: Scheme) =>
    nameSortKey(a.name).localeCompare(nameSortKey(b.name), 'en', { sensitivity: 'base' });

export function searchIndex(index: SchemeIndex, filters: SchemeFilters = {}, page = 1, pageSize = PAGE_SIZE): SchemePage {
    const q = filters.q?.trim() ?? '';
    const hasQuery = q.length > 0;
    const terms = hasQuery ? queryTerms(q) : [];
    const phrase = hasQuery ? fold(q) : '';
    // A query with no usable words matches nothing, rather than everything.
    const queryTooGeneral = hasQuery && terms.length === 0;

    const hits: { scheme: Scheme; score: number }[] = [];
    if (!queryTooGeneral) {
        for (const entry of index.entries) {
            if (!matchesFilters(entry.scheme, filters)) continue;
            const s = hasQuery ? score(entry, terms, phrase) : 1;
            if (s > 0) hits.push({ scheme: entry.scheme, score: s });
        }
    }

    hits.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // With a state selected, schemes named for that state come before all-India ones.
        if (filters.state) {
            const aLocal = a.scheme.states.includes(filters.state) ? 0 : 1;
            const bLocal = b.scheme.states.includes(filters.state) ? 0 : 1;
            if (aLocal !== bLocal) return aLocal - bLocal;
        }
        return byName(a.scheme, b.scheme);
    });

    const total = hits.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
    const start = (current - 1) * pageSize;

    return {
        items: hits.slice(start, start + pageSize).map((h) => h.scheme),
        total,
        page: current,
        pageSize,
        totalPages,
        queryTooGeneral,
    };
}

/**
 * Other schemes in the same area for the "More in <area>" list, most related
 * first: same issuer, then same state (or both all-India), then shared tags,
 * then name (ignoring leading quotes and punctuation).
 */
export function rankRelated(target: Scheme, candidates: Scheme[], limit = 3): Scheme[] {
    const primary = target.categories[0];
    if (!primary) return [];
    const targetTags = new Set(target.tags.map((t) => t.toLowerCase()));
    const sameIssuer = (s: Scheme) => Boolean(target.issuer) && s.issuer === target.issuer;
    const sameState = (s: Scheme) =>
        target.allIndia ? s.allIndia : s.states.some((st) => target.states.includes(st));
    const sharedTags = (s: Scheme) => s.tags.filter((t) => targetTags.has(t.toLowerCase())).length;

    return candidates
        .filter((s) => s.slug !== target.slug && s.categories.includes(primary))
        .map((s) => ({ s, issuer: sameIssuer(s) ? 1 : 0, state: sameState(s) ? 1 : 0, tags: sharedTags(s) }))
        .sort((a, b) =>
            b.issuer - a.issuer || b.state - a.state || b.tags - a.tags || byName(a.s, b.s)
        )
        .slice(0, limit)
        .map((x) => x.s);
}

export function computeStats(schemes: Scheme[]): SchemeStats {
    const categories = new Set<string>();
    const states = new Set<string>();
    const issuers = new Set<string>();
    let central = 0;
    for (const s of schemes) {
        if (s.level === 'Central') central++;
        s.categories.forEach((c) => categories.add(c));
        s.states.forEach((st) => states.add(st));
        if (s.issuer) issuers.add(s.issuer);
    }
    return {
        total: schemes.length,
        central,
        state: schemes.length - central,
        categories: categories.size,
        states: states.size,
        issuers: issuers.size,
    };
}

function countOptions(values: string[], label: (v: string) => string): FilterOption[] {
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts.entries()]
        .map(([value, count]) => ({ value, label: label(value), count }))
        .sort((a, b) => a.label.localeCompare(b.label, 'en'));
}

export function computeFilterOptions(schemes: Scheme[]): SchemeFilterOptions {
    return {
        states: countOptions(schemes.flatMap((s) => s.states), (v) => v),
        categories: countOptions(schemes.flatMap((s) => s.categories), categoryLabel),
        levels: countOptions(schemes.map((s) => s.level), (v) => v),
        audiences: countOptions(
            schemes.flatMap((s) => (s.audience ? [s.audience] : [])),
            audienceLabel
        ),
    };
}

type SearchParamValue = string | string[] | undefined;

function first(value: SearchParamValue): string {
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

/**
 * Reads /services query params into validated filters. Unknown filter values
 * are dropped (so a hand-edited URL can't produce an empty, confusing page);
 * q is capped at 120 characters.
 */
export function parseSchemeFilters(
    params: Record<string, SearchParamValue>,
    options: SchemeFilterOptions
): { filters: SchemeFilters; page: number } {
    const known = (value: string, opts: FilterOption[]) =>
        opts.some((o) => o.value === value) ? value : undefined;

    const level = first(params.level);
    const page = parseInt(first(params.page), 10);

    return {
        filters: {
            q: first(params.q).slice(0, 120) || undefined,
            state: known(first(params.state), options.states),
            category: known(first(params.category), options.categories),
            level: level === 'Central' || level === 'State' ? level : undefined,
            audience: known(first(params.for), options.audiences),
        },
        page: Number.isFinite(page) && page > 0 ? page : 1,
    };
}

/** Builds a /services URL for the given filters and page (used by pagination and chips). */
export function servicesHref(filters: SchemeFilters, page = 1): string {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.state) params.set('state', filters.state);
    if (filters.category) params.set('category', filters.category);
    if (filters.level) params.set('level', filters.level);
    if (filters.audience) params.set('for', filters.audience);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return qs ? `/services?${qs}` : '/services';
}

/** /chat link that pre-fills (does not send) a question about the scheme. */
export function askHref(question: string): string {
    return `/chat?q=${encodeURIComponent(question)}`;
}

// ── Module-cached default dataset ─────────────────────────────────────────

let cachedIndex: SchemeIndex | null = null;
let cachedStats: SchemeStats | null = null;
let cachedOptions: SchemeFilterOptions | null = null;

function defaultIndex(): SchemeIndex {
    if (!cachedIndex) cachedIndex = buildIndex(rawDataset as unknown);
    return cachedIndex;
}

function allSchemes(): Scheme[] {
    return defaultIndex().entries.map((e) => e.scheme);
}

export function getSchemes(filters: SchemeFilters = {}, page = 1): SchemePage {
    return searchIndex(defaultIndex(), filters, page);
}

export function getScheme(slug: string): Scheme | undefined {
    return defaultIndex().bySlug.get(slug);
}

/** "More in <area>" for a scheme detail page; see rankRelated. */
export function getRelatedSchemes(scheme: Scheme, limit = 3): Scheme[] {
    const candidates = scheme.categories[0]
        ? allSchemes().filter((s) =>
            scheme.allIndia || appliesToState(s, scheme.states[0] ?? '') || s.issuer === scheme.issuer
        )
        : [];
    return rankRelated(scheme, candidates, limit);
}

export function getStats(): SchemeStats {
    if (!cachedStats) cachedStats = computeStats(allSchemes());
    return cachedStats;
}

export function getFilterOptions(): SchemeFilterOptions {
    if (!cachedOptions) cachedOptions = computeFilterOptions(allSchemes());
    return cachedOptions;
}

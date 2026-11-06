/**
 * Title matching for the scheme dataset.
 *
 * The embedding model is weak at exact names: "Ayushman Bharat" returned
 * "AYUSH Health and Wellness Centre", "Indira Gandhi Pyari Behna..." and others
 * but not "Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana", whose title
 * contains exactly those words. When every distinctive word of the question
 * appears in a scheme's title, that scheme is a strong match whatever its
 * embedding says, so it is promoted (see LocalVectorStore.searchWithTitleBoost).
 *
 * Pure functions, no I/O.
 */

import { FILLER_WORDS, GENERIC_TOPICS } from './ai/chat-request';

/** Words that appear in countless titles or say nothing about which scheme is meant. */
const NON_DISTINCTIVE = new Set([
    'scheme', 'schemes', 'yojana', 'yojna', 'yojnaye', 'programme', 'program', 'service', 'services', 'government', 'govt', 'sarkari', 'india', 'indian',
    'new', 'id', 'start', 'starting', 'help', 'helps', 'helping', 'free', 'get', 'getting', 'give', 'gives', 'person', 'people', 'family', 'families', 'support',
]);

/**
 * Category words people add that a scheme's title may not repeat ("Ayushman Bharat
 * card" is titled "Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana"). Used only
 * as a second, relaxed pass when the strict one finds nothing.
 */
const SOFT_WORDS = new Set(['card', 'cards', 'loan', 'loans', 'certificate', 'account', 'insurance', 'registration', 'portal', 'application']);

/** The distinctive words minus the soft ones, for the relaxed second pass. */
export function relaxedTokens(tokens: string[]): string[] {
    return tokens.filter((t) => !SOFT_WORDS.has(t));
}

/** A broad query matches too many titles to say which one is meant: promote nothing. */
export const MAX_TITLE_CANDIDATES = 6;

export function tokenizeTitle(text: string): string[] {
    return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** The words of a question that would have to appear in the title of the scheme it names. */
export function distinctiveTokens(query: string): string[] {
    const seen = new Set<string>();
    for (const w of tokenizeTitle(query)) {
        if (FILLER_WORDS.has(w) || GENERIC_TOPICS.has(w) || NON_DISTINCTIVE.has(w)) continue;
        seen.add(w);
    }
    return [...seen];
}

/** Worth looking for in titles: two or more words, or a single word long enough to be a name ("mudra"). */
export function isSpecificEnough(tokens: string[]): boolean {
    return tokens.length >= 2 || (tokens.length === 1 && tokens[0].length >= 4);
}

/** "PM" is "Pradhan Mantri" in titles, and "CM" is "Chief Minister" or "Mukhyamantri". */
function hasToken(title: Set<string>, token: string): boolean {
    if (title.has(token)) return true;
    if (token === 'pm') return title.has('pradhan') && title.has('mantri');
    if (token === 'cm') return title.has('mukhyamantri') || (title.has('chief') && title.has('minister'));
    return false;
}

/** True when every distinctive word of the question is in the title. */
export function titleSatisfies(title: Set<string>, tokens: string[]): boolean {
    return tokens.length > 0 && tokens.every((t) => hasToken(title, t));
}

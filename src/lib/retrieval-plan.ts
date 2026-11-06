/**
 * Decides whether the bundled dataset can answer a question, or the official
 * government sites must be searched live.
 *
 * The dataset is a snapshot of short scheme summaries: for almost every scheme
 * it holds only who runs it, the category, who it is for and the official page.
 * Just 2 of its 4,740 entries have "APPLICATION PROCESS" or "REQUIRED DOCUMENTS"
 * sections. So a scheme can be found correctly and still not answer "how do I
 * apply?". "Not in the dataset" therefore means either
 *   1. none of the retrieved entries is about what was asked (Sukanya Samriddhi,
 *      PAN card, driving licence: not schemes in the snapshot), or
 *   2. the question asks for something the entries do not contain (steps,
 *      documents, eligibility, amounts, contact details).
 * In both cases InBridge searches the official sites and answers from them.
 *
 * Pure functions, no I/O.
 */

import { distinctiveTokens, relaxedTokens, tokenizeTitle } from './title-match';

export type Intent = 'apply' | 'documents' | 'eligibility' | 'amount' | 'contact' | 'status';

/**
 * What the user wants to know about a scheme, read from their own words (English,
 * Hinglish or Hindi). Cleaning for search drops words like "how" / "kaise", so
 * this must run on the original text.
 */
const INTENT_PATTERNS: Array<[Intent, RegExp]> = [
    ['apply', /\b(apply|applying|application|process|procedure|steps?|register|registration|enrol\w*|enroll\w*|renew\w*|correction|update|how (?:do|can|should|to)\b|kaise|kaisey|kaise|banwa\w*|banwan\w*|banaye|khulwa\w*|aavedan|avedan|milega|milegi)\b|आवेदन|कैसे|पंजीकरण|रजिस्ट्रेशन|बनवा|मिलेगा|मिलेगी|प्रक्रिया/i],
    ['documents', /\b(documents?|papers?|proofs?|certificates? (?:needed|required)|dastavez|dastawez|kagaz|kagzat)\b|दस्तावेज|कागज़|कागज|प्रमाण पत्र/i],
    ['eligibility', /\b(eligib\w*|criteria|qualif\w*|who can|age limit|income limit|income criteria|patrata|yogyata)\b|पात्रता|योग्यता/i],
    ['amount', /\b(how much|amount|benefits?|installments?|stipend|subsidy|money|payment|salary|fees?|charges?|cost|kitna|kitni|paisa|paise|rashi|labh)\b|कितना|कितनी|राशि|पैसा|पैसे|लाभ/i],
    ['contact', /\b(helpline|contact|phone number|toll.?free|customer care|email)\b|हेल्पलाइन|संपर्क/i],
    ['status', /\b(status|track|tracking|check my|installment date|payment date|beneficiary list|kab milega)\b|स्थिति|स्टेटस/i],
];

export function detectIntents(text: string): Intent[] {
    return INTENT_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([intent]) => intent);
}

/** Does this dataset entry contain what the intent asks for? */
const COVERAGE: Record<Intent, RegExp> = {
    apply: /APPLICATION PROCESS/i,
    documents: /REQUIRED DOCUMENTS/i,
    eligibility: /ELIGIBILITY/i,
    amount: /(?:₹|\bRs\.?)\s?\d/i,
    contact: /HELPLINE|OFFICIAL PORTAL/,
    // A snapshot can never tell a person where their own application stands.
    status: /(?!)/,
};

export function coversIntent(content: string, intent: Intent): boolean {
    return COVERAGE[intent].test(content);
}

export interface PlanDoc {
    title: string;
    content: string;
}

/**
 * Share of the question's distinctive words an entry must contain to count as being
 * about it. 0.6 means both words of a two-word name: "Sukanya Samriddhi" must not
 * pass because an unrelated title contains "Samriddhi".
 */
const RELEVANCE_SHARE = 0.6;

/** Plural-insensitive: "scholarships" matches "scholarship". */
function stem(word: string): string {
    return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

/**
 * True when the entry is about the subject of the question: at least 60% of the
 * question's distinctive words appear in its title or opening sentence. Words deep
 * in the description do not count: "voter ID card" must not match the Aadhaar
 * entry because it mentions voter ID once as an accepted proof. Category words
 * such as "card" and "loan" are ignored (a title need not repeat them). A question
 * with no distinctive words (nothing to judge by) is treated as relevant.
 */
export function isRelevantDoc(query: string, doc: PlanDoc): boolean {
    const distinct = distinctiveTokens(query);
    const core = relaxedTokens(distinct);
    const wanted = (core.length > 0 ? core : distinct).map(stem);
    if (wanted.length === 0) return true;
    const have = new Set(tokenizeTitle(`${doc.title} ${doc.content.slice(0, 160)}`).map(stem));
    // "pm" is "Pradhan Mantri" in the data.
    const hit = (t: string) => have.has(t) || (t === 'pm' && have.has('pradhan') && have.has('mantri'));
    return wanted.filter(hit).length / wanted.length >= RELEVANCE_SHARE;
}

export interface RetrievalPlan {
    /** Entries that are actually about the question. */
    relevant: number[];
    /** Search the official sites live. */
    needsLive: boolean;
    reason: 'dataset-answers' | 'nothing-relevant' | 'missing-details';
}

/**
 * `docs` are the dataset hits in rank order. `intents` come from the user's own
 * wording (see detectIntents).
 */
export function planRetrieval(query: string, docs: PlanDoc[], intents: Intent[]): RetrievalPlan {
    const relevant = docs.map((d, i) => (isRelevantDoc(query, d) ? i : -1)).filter((i) => i >= 0);
    if (relevant.length === 0) return { relevant, needsLive: true, reason: 'nothing-relevant' };
    const covered = intents.every((intent) => relevant.some((i) => coversIntent(docs[i].content, intent)));
    return covered
        ? { relevant, needsLive: false, reason: 'dataset-answers' }
        : { relevant, needsLive: true, reason: 'missing-details' };
}

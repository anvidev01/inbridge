/**
 * The text the scheme search actually runs on.
 *
 * Question framing ("What is", "How do I", "Tell me about", "What documents are
 * needed for") adds words that appear in no scheme title and pull the search
 * towards unrelated schemes: "What is PM-KISAN?" and "How can I get a Mudra
 * loan?" both missed their scheme until the framing was removed, and "PM-KISAN"
 * and "Mudra loan" found it. Hindi typed in English letters is cleaned the same
 * way (see hinglish.ts). Only the search sees the result; the model still gets
 * the user's own words.
 */

import { normalizeHinglishQuery } from './hinglish';

/** Leading phrases that only frame a question. Applied repeatedly, longest first. */
const FRAMING: RegExp[] = [
    /^(?:please\s+|pls\s+|plz\s+)/i,
    /^(?:can|could|would|will) you (?:please )?(?:tell|explain|help|show|give|share)(?: me)?(?: about| with| the details of| details of| more about)?\s+/i,
    /^(?:tell|explain|show|give|share)(?: me)?(?: about| the details of| details of| more about| all about)?\s+/i,
    /^(?:what|which) (?:documents?|papers?|certificates?) (?:are|is|do i need|should i (?:have|carry|submit)) (?:needed|required|necessary)?\s*(?:for|to apply for|to get)?\s*/i,
    /^(?:what|which) (?:is|are|was|were) (?:the )?(?:eligibility|benefits?|process|procedure|last date|deadline|fees?|status|documents?)(?: criteria)?(?: for| of| to apply for)?\s+/i,
    /^(?:what|which) (?:is|are|was|were) (?:the )?/i,
    /^(?:how|where) (?:do|can|should|could|would|to) (?:i |we |you )?(?:to )?(?:apply for |apply to |get |obtain |register for |register in |check |find )?/i,
    /^(?:i (?:want|need|would like|wish) to |i am looking for |i'm looking for )(?:know about |apply for |get )?/i,
    /^(?:is|are) there (?:any |a |an )?/i,
];

/** One line of English with the question framing removed; unchanged if nothing useful would remain. */
export function stripQuestionFraming(line: string): string {
    let text = line.trim();
    for (let pass = 0; pass < 3; pass++) {
        const before = text;
        for (const pattern of FRAMING) text = text.replace(pattern, '');
        if (text === before) break;
    }
    text = text.replace(/[?.!\s]+$/, '').replace(/^(?:the|a|an)\s+/i, '').trim();
    // Keep the original when too little is left to search with.
    return text.split(/\s+/).filter(Boolean).length >= 1 && text.length >= 3 ? text : line.trim();
}

/** Hinglish cleanup, then English framing removal, line by line (follow-ups join earlier turns with newlines). */
export function normalizeSearchQuery(text: string): string {
    return normalizeHinglishQuery(text)
        .split('\n')
        .map((line) => stripQuestionFraming(line))
        .filter(Boolean)
        .join('\n');
}

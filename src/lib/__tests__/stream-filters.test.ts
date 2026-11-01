import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    DashRewriter,
    FOLLOWUPS_MARKER,
    FollowupSplitter,
    ThinkStripper,
    fixedFollowups,
    parseFollowups,
    partialTokenSuffix,
    rewriteDashes,
} from '../ai/stream-filters';

/** Feeds chunks through a splitter and returns what the client would see. */
function runSplitter(chunks: string[]) {
    const splitter = new FollowupSplitter();
    const emitted: string[] = [];
    for (const c of chunks) emitted.push(splitter.push(c));
    emitted.push(splitter.flush());
    return { visible: emitted.join(''), emitted, splitter };
}

describe('partialTokenSuffix', () => {
    test('finds the longest tail that could start the token', () => {
        assert.equal(partialTokenSuffix('answer ---FOLL', FOLLOWUPS_MARKER), 7);
        assert.equal(partialTokenSuffix('answer -', FOLLOWUPS_MARKER), 1);
        assert.equal(partialTokenSuffix('answer', FOLLOWUPS_MARKER), 0);
    });
});

describe('FollowupSplitter', () => {
    test('never forwards the marker or anything after it', () => {
        const { visible, splitter } = runSplitter([
            'PM-KISAN pays farmers [1].\n\n',
            `${FOLLOWUPS_MARKER}\n["How do I apply?", "Documents?", "Status?"]`,
        ]);
        assert.equal(visible, 'PM-KISAN pays farmers [1].\n\n');
        assert.ok(splitter.markerSeen);
        assert.deepEqual(parseFollowups(splitter.tail), ['How do I apply?', 'Documents?', 'Status?']);
    });

    test('handles a marker split across chunks', () => {
        const { visible, emitted, splitter } = runSplitter([
            'Answer text.\n---FOLL',
            'OWUPS---\n["a', 'b?", "c?"]',
        ]);
        assert.equal(visible, 'Answer text.\n');
        // The partial marker was held back, not sent and later retracted.
        assert.ok(!emitted.some((e) => e.includes('---FOLL')));
        assert.deepEqual(parseFollowups(splitter.tail), ['ab?', 'c?']);
    });

    test('handles a marker split one character at a time', () => {
        const text = `Hello.\n${FOLLOWUPS_MARKER}["x?"]`;
        const { visible, splitter } = runSplitter(text.split(''));
        assert.equal(visible, 'Hello.\n');
        assert.deepEqual(parseFollowups(splitter.tail), ['x?']);
    });

    test('releases held-back dashes that turn out to be ordinary text', () => {
        const { visible, splitter } = runSplitter(['Steps:\n--', '- item one\n---\nmore', ' text -']);
        assert.equal(visible, 'Steps:\n--- item one\n---\nmore text -');
        assert.equal(splitter.markerSeen, false);
    });
});

describe('parseFollowups', () => {
    test('caps at three, trims, dedupes and drops non-strings', () => {
        const tail = '\n["  one? ", "one?", 5, "two?", "three?", "four?"]';
        assert.deepEqual(parseFollowups(tail), ['one?', 'two?', 'three?']);
    });

    test('drops entries with URLs or markdown', () => {
        assert.deepEqual(parseFollowups('["see https://x.gov.in", "**bold**", "ok?"]'), ['ok?']);
    });

    test('returns null on malformed or empty output', () => {
        assert.equal(parseFollowups(''), null);
        assert.equal(parseFollowups('not json'), null);
        assert.equal(parseFollowups('["unterminated'), null);
        assert.equal(parseFollowups('[]'), null);
        assert.equal(parseFollowups('{"a": 1}'), null);
    });
});

describe('fixedFollowups', () => {
    test('has three localised questions for every language', () => {
        for (const lang of ['en', 'hi', 'hinglish'] as const) {
            assert.equal(fixedFollowups(lang).length, 3);
            assert.equal(fixedFollowups(lang, 'grievance').length, 3);
        }
        assert.match(fixedFollowups('hi')[0], /[ऀ-ॿ]/);
        assert.doesNotMatch(fixedFollowups('hinglish').join(' '), /[ऀ-ॿ]/);
    });

    test('returns a copy', () => {
        fixedFollowups('en').push('mutated');
        assert.equal(fixedFollowups('en').length, 3);
    });
});

describe('ThinkStripper', () => {
    function strip(chunks: string[]): string {
        const s = new ThinkStripper();
        return chunks.map((c) => s.push(c)).join('') + s.flush();
    }

    test('removes a think block', () => {
        assert.equal(strip(['<think>private</think>Answer']), 'Answer');
    });

    test('removes a think block split across chunks', () => {
        assert.equal(strip(['<thi', 'nk>reason', 'ing</th', 'ink>Visible ', 'text']), 'Visible text');
    });

    test('leaves text without tags untouched, including a lone "<"', () => {
        assert.equal(strip(['a < b', ' and c']), 'a < b and c');
    });

    test('drops an unclosed think block at end of stream', () => {
        assert.equal(strip(['Before <think>never closed']), 'Before ');
    });
});

const EM = '\u2014';
const EN = '\u2013';

/** Feeds chunks through a DashRewriter and returns what the client would see. */
function runDashes(chunks: string[]): string {
    const rewriter = new DashRewriter();
    return chunks.map((c) => rewriter.push(c)).join('') + rewriter.flush();
}

describe('rewriteDashes', () => {
    test('a spaced or closed-up em dash becomes a comma', () => {
        assert.equal(rewriteDashes(`PM-KISAN pays farmers ${EM} three times a year.`), 'PM-KISAN pays farmers, three times a year.');
        assert.equal(rewriteDashes(`farmers${EM}three times`), 'farmers, three times');
        assert.equal(rewriteDashes(`Apply online ${EN} it is free.`), 'Apply online, it is free.');
    });

    test('a pair of dashes around an aside becomes a pair of commas', () => {
        assert.equal(
            rewriteDashes(`The scheme ${EM} run by the ministry ${EM} pays monthly.`),
            'The scheme, run by the ministry, pays monthly.'
        );
    });

    test('a dash ending a line before a list becomes a colon', () => {
        assert.equal(rewriteDashes(`You will need ${EM}\n- Aadhaar\n- Bank passbook`), 'You will need:\n- Aadhaar\n- Bank passbook');
    });

    test('a dash starting a line becomes a markdown bullet', () => {
        assert.equal(rewriteDashes(`Documents:\n${EM} Aadhaar\n  ${EM} Ration card`), 'Documents:\n- Aadhaar\n  - Ration card');
        assert.equal(rewriteDashes(`${EM} First item`), '- First item');
    });

    test('next to other punctuation the dash is dropped', () => {
        assert.equal(rewriteDashes(`Yes, ${EM} you can.`), 'Yes, you can.');
        assert.equal(rewriteDashes(`Check the portal ${EM}.`), 'Check the portal.');
        assert.equal(rewriteDashes(`(${EM} optional)`), '(optional)');
    });

    test('hyphens, hyphenated words and number ranges are left intact', () => {
        const text = 'PM-KISAN for 2024-25 pays Rs 2,000 in pages 10-20 of the e-Shram guide.';
        assert.equal(rewriteDashes(text), text);
        assert.equal(rewriteDashes(`For 2024${EN}25 and pages 10${EN}20.`), 'For 2024-25 and pages 10-20.');
    });

    test('a dash in a table cell stays a cell placeholder', () => {
        assert.equal(rewriteDashes(`| Amount | ${EM} |`), '| Amount | - |');
    });

    test('Hindi text gets a comma too', () => {
        assert.equal(rewriteDashes(`यह योजना ${EM} किसानों के लिए है।`), 'यह योजना, किसानों के लिए है।');
    });

    test('text without dashes is returned unchanged', () => {
        const text = '## Documents needed\n\n- Aadhaar [1]\n- Land records [2]\n\n---';
        assert.equal(rewriteDashes(text), text);
    });
});

describe('DashRewriter', () => {
    test('a dash split from the words around it across chunks', () => {
        assert.equal(runDashes(['PM-KISAN pays farmers ', `${EM}`, ' three times a year.']), 'PM-KISAN pays farmers, three times a year.');
        assert.equal(runDashes([`farmers ${EM}`, ' three times']), 'farmers, three times');
        assert.equal(runDashes(['farmers ', `${EM} three times`]), 'farmers, three times');
    });

    test('a dash at a chunk end followed by a newline in the next chunk becomes a colon', () => {
        assert.equal(runDashes([`You will need ${EM}`, '\n- Aadhaar']), 'You will need:\n- Aadhaar');
    });

    test('a dash at the start of a chunk that starts a line becomes a bullet', () => {
        assert.equal(runDashes(['Documents:\n', `${EM} Aadhaar`]), 'Documents:\n- Aadhaar');
    });

    test('a range split across chunks keeps its hyphen', () => {
        assert.equal(runDashes(['For 2024', `${EN}`, '25 only.']), 'For 2024-25 only.');
        assert.equal(runDashes(['For 2024-', '25 only.']), 'For 2024-25 only.');
    });

    test('hyphenated words split across chunks pass through', () => {
        assert.equal(runDashes(['PM-', 'KISAN and e-', 'Shram']), 'PM-KISAN and e-Shram');
    });

    test('spaces are only held back, never lost', () => {
        assert.equal(runDashes(['Apply ', 'online ', '  now']), 'Apply online   now');
        assert.equal(runDashes(['trailing space ']), 'trailing space ');
    });

    test('every chunking of a sentence gives the same result', () => {
        const input = `The scheme ${EM} run by the ministry ${EM} pays for 2024${EN}25.\nYou need ${EM}\n${EM} Aadhaar`;
        const expected = rewriteDashes(input);
        assert.equal(expected, 'The scheme, run by the ministry, pays for 2024-25.\nYou need:\n- Aadhaar');
        for (let size = 1; size <= input.length; size++) {
            const chunks: string[] = [];
            for (let i = 0; i < input.length; i += size) chunks.push(input.slice(i, i + size));
            assert.equal(runDashes(chunks), expected, `chunk size ${size}`);
        }
    });

    test('a dash at the very end of the stream is not left dangling', () => {
        assert.equal(runDashes([`Check the portal ${EM}`]), 'Check the portal');
    });

    test('spaced ranges between figures keep their meaning', () => {
        assert.equal(rewriteDashes(`Age 18 ${EN} 40 years`), 'Age 18 to 40 years');
        assert.equal(rewriteDashes(`Rs 6,000 ${EN} Rs 12,000 a year`), 'Rs 6,000 to Rs 12,000 a year');
        assert.equal(rewriteDashes(`₹500 ${EM} ₹2,000`), '₹500 to ₹2,000');
        assert.equal(rewriteDashes(`January${EN}March`), 'January-March');
    });

    test('a line-ending dash becomes a colon only before a list', () => {
        assert.equal(rewriteDashes(`You need ${EM}\n- Aadhaar`), 'You need:\n- Aadhaar');
        assert.equal(rewriteDashes(`You need ${EM}\n1. Aadhaar`), 'You need:\n1. Aadhaar');
        assert.equal(rewriteDashes(`That is all ${EM}\nThen apply online.`), 'That is all.\nThen apply online.');
    });

    test('a dash after a blockquote marker is dropped', () => {
        assert.equal(rewriteDashes(`> ${EM} as the portal says`), '> as the portal says');
    });
});

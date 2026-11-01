import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    FOLLOWUPS_MARKER,
    FollowupSplitter,
    ThinkStripper,
    fixedFollowups,
    parseFollowups,
    partialTokenSuffix,
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

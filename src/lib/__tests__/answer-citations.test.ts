import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { splitCitations, stripCitations, hostOf, isGovHost } from '../answer/citations';

describe('splitCitations', () => {
    test('turns in-range markers into cite segments', () => {
        assert.deepEqual(splitCitations('PM-KISAN pays farmers [1].', 2), [
            { type: 'text', value: 'PM-KISAN pays farmers ' },
            { type: 'cite', n: 1 },
            { type: 'text', value: '.' },
        ]);
    });

    test('leaves out-of-range markers as plain text', () => {
        assert.deepEqual(splitCitations('See [3] and [0].', 2), [{ type: 'text', value: 'See [3] and [0].' }]);
    });

    test('treats every marker as text when there are no sources', () => {
        assert.deepEqual(splitCitations('Claim [1].', 0), [{ type: 'text', value: 'Claim [1].' }]);
    });

    test('splits grouped markers and keeps invalid members as text', () => {
        assert.deepEqual(splitCitations('x [1, 2, 9]', 2), [
            { type: 'text', value: 'x ' },
            { type: 'cite', n: 1 },
            { type: 'cite', n: 2 },
            { type: 'text', value: '[9]' },
        ]);
    });

    test('handles adjacent markers', () => {
        const segs = splitCitations('a[1][2]', 2);
        assert.deepEqual(segs.map((s) => s.type), ['text', 'cite', 'cite']);
    });

    test('ignores years and partial markers while streaming', () => {
        assert.deepEqual(splitCitations('Budget [2024] and [1', 5), [{ type: 'text', value: 'Budget [2024] and [1' }]);
    });
});

describe('stripCitations', () => {
    test('removes markers and the space before punctuation', () => {
        assert.equal(stripCitations('Farmers get support [1]. Apply online [2, 3]!'), 'Farmers get support. Apply online!');
    });
});

describe('hostOf / isGovHost', () => {
    test('strips www and lowercases', () => {
        assert.equal(hostOf('https://WWW.PMKisan.gov.in/x'), 'pmkisan.gov.in');
        assert.equal(hostOf('not a url'), '');
    });

    test('accepts gov.in and nic.in subdomains only', () => {
        assert.ok(isGovHost('pmkisan.gov.in'));
        assert.ok(isGovHost('nic.in'));
        assert.ok(!isGovHost('gov.in.example.com'));
        assert.ok(!isGovHost('notgov.in'));
    });
});

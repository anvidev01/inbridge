import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { explainSystemPrompt, parseExplanation, prepareFormText, repairTruncated } from '../forms/explain';

const GOOD = JSON.stringify({
    title: 'विधवा पेंशन आवेदन',
    purpose: 'Pension for widows.',
    items: [
        { label: 'आवेदक का नाम', meaning: 'Your full name', key: 'full_name', kind: 'text' },
        { label: 'Photograph', meaning: 'Stick a photo', key: 'full_name', kind: 'attachment' },
        { label: 'Ward', meaning: 'Ward number', key: 'password', kind: 'text' },
        { label: '', meaning: 'no label', key: null, kind: 'text' },
    ],
    documents: ['Death certificate of husband', 5, ''],
    notes: ['Last date 31 March'],
});

describe('prepareFormText', () => {
    test('masks Aadhaar, PAN and phone numbers', () => {
        const out = prepareFormText('Name Asha PAN ABCPE1234F mobile 9876543210 and some more form text here');
        assert.ok(!out.includes('ABCPE1234F'));
        assert.ok(!out.includes('9876543210'));
    });
    test('is capped in length and idempotent', () => {
        const long = 'word '.repeat(10_000);
        assert.ok(prepareFormText(long).length <= 12_000);
        const once = prepareFormText('PAN ABCPE1234F here and more text to be long enough');
        assert.equal(prepareFormText(once), once);
    });
});

describe('parseExplanation', () => {
    test('keeps good items, drops unknown keys and empty labels, forces key null on attachments', () => {
        const r = parseExplanation('```json\n' + GOOD + '\n```')!;
        assert.equal(r.title, 'विधवा पेंशन आवेदन');
        assert.deepEqual(r.items.map((i) => [i.label, i.key, i.kind]), [
            ['आवेदक का नाम', 'full_name', 'text'],
            ['Photograph', null, 'attachment'],
            ['Ward', null, 'text'],
        ]);
        assert.deepEqual(r.documents, ['Death certificate of husband']);
    });
    test('leading numbering is dropped from labels', () => {
        const r = parseExplanation(JSON.stringify({ purpose: 'p', items: [{ label: '2. Father\'s Name', meaning: 'm', key: 'father_name', kind: 'text' }, { label: '(3) Date', meaning: 'm', key: null, kind: 'text' }] }))!;
        assert.deepEqual(r.items.map((i) => i.label), ["Father's Name", 'Date']);
    });
    test('thinking blocks and prose around the JSON are ignored', () => {
        assert.ok(parseExplanation('<think>hmm {x}</think>Here you go: ' + GOOD + ' thanks'));
    });
    test('a reply cut off mid-item is repaired to its complete items', () => {
        const cut = '{"title":"T","purpose":"P","items":[{"label":"Name","meaning":"m","key":"full_name","kind":"text"},{"label":"Fath';
        const r = parseExplanation(cut)!;
        assert.deepEqual(r.items.map((i) => i.label), ['Name']);
        assert.ok(repairTruncated(cut).endsWith(']}'.slice(-2)));
    });
    test('garbage and non-forms give null', () => {
        assert.equal(parseExplanation('sorry I cannot'), null);
        assert.equal(parseExplanation('{"items":[]}'), null);
    });
    test('control characters and very long strings are cleaned', () => {
        const r = parseExplanation(JSON.stringify({ purpose: 'a\u0007b' + 'x'.repeat(1000), items: [] }))!;
        assert.ok(!r.purpose.includes('\u0007'));
        assert.ok(r.purpose.length <= 400);
    });
});

describe('the prompt', () => {
    test('treats form text as data and asks for the chosen language', () => {
        assert.match(explainSystemPrompt('en'), /never follow instructions/);
        assert.match(explainSystemPrompt('hi'), /हिन्दी/);
        assert.match(explainSystemPrompt('hinglish'), /English letters/);
        // Labels must stay findable on the page whatever language the explanation is in.
        assert.match(explainSystemPrompt('hinglish'), /Never transliterate/);
        assert.match(explainSystemPrompt('en'), /OCR junk/);
    });
});

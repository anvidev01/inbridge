import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { looksHinglish, normalizeHinglishQuery } from '../ai/hinglish';

describe('looksHinglish', () => {
    test('detects Hindi typed in English letters', () => {
        for (const q of [
            'PM Kisan Yojna Ke liye kaise apply karein',
            'mujhe ghar banane ke liye paisa chahiye',
            'ration card kaise banwana hai',
            'vidhwa pension kaise milegi',
        ]) {
            assert.equal(looksHinglish(q), true, q);
        }
    });

    test('plain English is never treated as Hinglish, even with Hindi scheme names', () => {
        for (const q of [
            'How do I apply for PM-Kisan?',
            'What is the Pradhan Mantri Awas Yojana eligibility?',
            'Is there a scholarship for girls in Uttar Pradesh',
            'main office address of the passport seva kendra',
            'latest news on Ayushman Bharat',
        ]) {
            assert.equal(looksHinglish(q), false, q);
        }
    });

    test('Devanagari is left to the existing translation step', () => {
        assert.equal(looksHinglish('पीएम किसान के लिए आवेदन कैसे करें'), false);
    });
});

describe('normalizeHinglishQuery', () => {
    const cases: Array<[string, string]> = [
        ['PM Kisan Yojna Ke liye kaise apply karein', 'PM Kisan scheme apply'],
        ['mujhe ghar banane ke liye paisa chahiye', 'house build money'],
        ['vidhwa pension kaise milegi', 'widow pension'],
        ['Mudra loan kaise milega', 'Mudra loan'],
        ['UP scholarship ke liye kaise apply karein', 'UP scholarship apply'],
        ['Ayushman Bharat card kaise banwaye', 'Ayushman Bharat card'],
    ];
    for (const [input, expected] of cases) {
        test(`"${input}" -> "${expected}"`, () => {
            assert.equal(normalizeHinglishQuery(input), expected);
        });
    }

    test('English questions pass through untouched', () => {
        for (const q of ['How do I apply for PM-Kisan?', 'Pradhan Mantri Awas Yojana eligibility', 'last date for scholarship submission']) {
            assert.equal(normalizeHinglishQuery(q), q);
        }
    });

    test('keeps the original when cleaning would leave almost nothing to search with', () => {
        assert.equal(normalizeHinglishQuery('kya hai'), 'kya hai');
        assert.equal(normalizeHinglishQuery('kaise karein'), 'kaise karein');
    });

    test('never returns an empty string', () => {
        for (const q of ['', '   ', 'karein', 'ke liye']) {
            assert.ok(normalizeHinglishQuery(q).length > 0 || q.trim() === '');
        }
    });
});

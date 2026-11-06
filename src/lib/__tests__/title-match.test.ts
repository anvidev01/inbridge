import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { distinctiveTokens, isSpecificEnough, titleSatisfies, tokenizeTitle } from '../title-match';

const title = (t: string) => new Set(tokenizeTitle(t));

describe('distinctiveTokens', () => {
    test('keeps the words that name the scheme and drops question and filler words', () => {
        assert.deepEqual(distinctiveTokens('Tell me about Ayushman Bharat'), ['ayushman', 'bharat']);
        assert.deepEqual(distinctiveTokens('How do I apply for PM-Kisan?'), ['pm', 'kisan']);
        assert.deepEqual(distinctiveTokens('What documents are needed for the Mudra scheme'), ['mudra']);
        assert.deepEqual(distinctiveTokens('PM Kisan apply'), ['pm', 'kisan']);
    });

    test('a question with no subject has no distinctive words', () => {
        assert.deepEqual(distinctiveTokens('where to apply?'), []);
        assert.deepEqual(distinctiveTokens('What is the last date?'), []);
    });
});

describe('isSpecificEnough', () => {
    test('two words, or one long word, can name a scheme; one short or generic word cannot', () => {
        assert.equal(isSpecificEnough(['ayushman', 'bharat']), true);
        assert.equal(isSpecificEnough(['mudra']), true);
        assert.equal(isSpecificEnough(['pan']), false);
        assert.equal(isSpecificEnough([]), false);
    });
});

describe('titleSatisfies', () => {
    test('requires every distinctive word', () => {
        const t = title('Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana');
        assert.equal(titleSatisfies(t, ['ayushman', 'bharat']), true);
        assert.equal(titleSatisfies(t, ['ayushman', 'card']), false);
        assert.equal(titleSatisfies(t, []), false);
    });

    test('PM stands for Pradhan Mantri, and a literal PM in the title also counts', () => {
        assert.equal(titleSatisfies(title('Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)'), ['pm', 'kisan']), true);
        assert.equal(titleSatisfies(title('Pradhan Mantri Mudra Yojana'), ['pm', 'mudra']), true);
        assert.equal(titleSatisfies(title('Kisan Credit Card'), ['pm', 'kisan']), false);
    });

    test('CM stands for Mukhyamantri', () => {
        assert.equal(titleSatisfies(title('Mukhyamantri Kanya Utthan Yojana'), ['cm', 'kanya']), true);
    });
});

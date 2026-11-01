import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSearchQuery, englishSearchQuery } from '../ai/translate';

describe('cleanSearchQuery', () => {
    test('keeps the first line and strips quotes and reasoning', () => {
        assert.equal(cleanSearchQuery('<think>hmm</think>\n"how to apply for scholarship"\nextra'), 'how to apply for scholarship');
        assert.equal(cleanSearchQuery('  PM-KISAN installment status  '), 'PM-KISAN installment status');
        assert.equal(cleanSearchQuery(''), '');
    });
});

describe('englishSearchQuery', () => {
    test('does nothing for Latin-script questions', async () => {
        assert.equal(await englishSearchQuery('PM-KISAN eligibility'), null);
    });
    test('returns null without an API key instead of throwing', async () => {
        const saved = process.env.GROQ_API_KEY;
        delete process.env.GROQ_API_KEY;
        try {
            assert.equal(await englishSearchQuery('छात्रवृत्ति के लिए कैसे आवेदन करें'), null);
        } finally {
            if (saved !== undefined) process.env.GROQ_API_KEY = saved;
        }
    });
});

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { expandStateAbbreviations } from '../rag-engine';

describe('expandStateAbbreviations', () => {
    test('spells out UP, TN and WB', () => {
        assert.equal(expandStateAbbreviations('How do I apply for UP scholarship?'), 'How do I apply for Uttar Pradesh scholarship?');
        assert.equal(expandStateAbbreviations('TN pension scheme'), 'Tamil Nadu pension scheme');
        assert.equal(expandStateAbbreviations('WB ration card'), 'West Bengal ration card');
    });

    test('handles dotted and sentence-final forms', () => {
        assert.equal(expandStateAbbreviations('scholarships in U.P. for girls'), 'scholarships in Uttar Pradesh for girls');
        assert.equal(expandStateAbbreviations('Is there a farmer scheme in UP'), 'Is there a farmer scheme in Uttar Pradesh');
    });

    test('leaves look-alike words alone', () => {
        for (const text of ['How do I register for UPI payments?', 'UPSC coaching scheme', 'business setup loan', 'Is there a startup subsidy', 'MP fund eligibility', 'AP pension']) {
            assert.equal(expandStateAbbreviations(text), text);
        }
    });

    test('only capitalised abbreviations change (lowercase "up" is a normal word)', () => {
        assert.equal(expandStateAbbreviations('how to top up my account, or sign up'), 'how to top up my account, or sign up');
    });

    test('a query with no abbreviation is unchanged', () => {
        assert.equal(expandStateAbbreviations('How do I apply for PM-Kisan?'), 'How do I apply for PM-Kisan?');
    });
});

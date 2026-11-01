import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isGovUrl, isRecencyQuery } from '../rag-engine';

describe('isGovUrl', () => {
    test('accepts official government hosts and subdomains', () => {
        assert.ok(isGovUrl('https://uidai.gov.in/en/'));
        assert.ok(isGovUrl('https://scholarships.gov.in/'));
        assert.ok(isGovUrl('https://pmkisan.gov.in/'));
        assert.ok(isGovUrl('https://www.myscheme.gov.in/schemes/pmksy'));
        assert.ok(isGovUrl('https://dbtbharat.nic.in/'));
    });

    test('rejects look-alike and non-government hosts', () => {
        assert.equal(isGovUrl('https://uidai-gov.in.example.com/'), false);
        assert.equal(isGovUrl('https://notgov.in/'), false);
        assert.equal(isGovUrl('https://example.com/gov.in'), false);
        assert.equal(isGovUrl('https://news.example.in/aadhaar'), false);
        assert.equal(isGovUrl('not a url'), false);
        assert.equal(isGovUrl(undefined), false);
    });
});

describe('isRecencyQuery', () => {
    test('detects requests for current information', () => {
        assert.ok(isRecencyQuery('give me latest Aadhaar Card schemes'));
        assert.ok(isRecencyQuery('new scholarship schemes'));
        assert.ok(isRecencyQuery('PM-KISAN 2026 installment'));
        assert.ok(isRecencyQuery('last date for NSP application'));
        assert.ok(isRecencyQuery('नवीनतम योजनाएं'));
    });

    test('leaves evergreen how-to questions to the vector store', () => {
        assert.equal(isRecencyQuery('PM-KISAN eligibility'), false);
        assert.equal(isRecencyQuery('how to link PAN with Aadhaar'), false);
    });
});

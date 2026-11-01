import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { findPii, isValidVerhoeff, maskPii, verhoeffCheckDigit } from '../pii-client';

/** A 12-digit number with a valid Verhoeff check digit (synthetic, not a real Aadhaar). */
function validAadhaar(base11: string): string {
    return base11 + verhoeffCheckDigit(base11);
}

describe('Verhoeff', () => {
    test('accepts the textbook example 2363 and rejects a one-digit change', () => {
        assert.equal(verhoeffCheckDigit('236'), 3);
        assert.equal(isValidVerhoeff('2363'), true);
        assert.equal(isValidVerhoeff('2364'), false);
    });

    test('rejects non-digit input', () => {
        assert.equal(isValidVerhoeff('23a3'), false);
        assert.equal(isValidVerhoeff(''), false);
    });
});

describe('findPii', () => {
    const aadhaar = validAadhaar('23456789012');

    test('flags a checksum-valid Aadhaar with or without separators', () => {
        const spaced = `${aadhaar.slice(0, 4)} ${aadhaar.slice(4, 8)} ${aadhaar.slice(8)}`;
        for (const text of [`my aadhaar is ${aadhaar}`, `my aadhaar is ${spaced}`]) {
            const found = findPii(text);
            assert.equal(found.length, 1, text);
            assert.equal(found[0].kind, 'aadhaar');
        }
    });

    test('does not flag a 12-digit number that fails the checksum', () => {
        const bad = aadhaar.slice(0, 11) + ((Number(aadhaar[11]) + 1) % 10);
        assert.deepEqual(findPii(`application ${bad}`), []);
    });

    test('does not flag ordinary queries with years or amounts', () => {
        const text = 'PM-KISAN installments for 2024 2025 2026, Rs 6000 per year, helpline 155261';
        // "2024 2025 2026" has the Aadhaar shape but fails the Verhoeff check.
        assert.equal(isValidVerhoeff('202420252026'), false);
        assert.deepEqual(findPii(text), []);
    });

    test('flags PAN in upper or lower case, but not random codes', () => {
        assert.equal(findPii('PAN ABCPE1234F')[0]?.kind, 'pan');
        assert.equal(findPii('pan abcpe1234f')[0]?.kind, 'pan');
        // 4th letter Z is not a PAN holder type
        assert.deepEqual(findPii('code ABCZE1234F'), []);
    });

    test('flags Indian mobile numbers with common prefixes', () => {
        for (const text of ['call 9876543210', 'call +91 98765 43210', 'call 09876543210', 'call 919876543210']) {
            const found = findPii(text);
            assert.equal(found.length, 1, text);
            assert.equal(found[0].kind, 'phone', text);
        }
    });

    test('does not flag a mobile-shaped run inside a longer number', () => {
        assert.deepEqual(findPii('ref 1239876543210').filter((m) => m.kind === 'phone'), []);
    });

    test('returns matches in order with offsets', () => {
        const text = `PAN ABCPE1234F and phone 9876543210`;
        const found = findPii(text);
        assert.deepEqual(found.map((m) => m.kind), ['pan', 'phone']);
        assert.equal(text.slice(found[1].start, found[1].end), '9876543210');
    });
});

describe('maskPii', () => {
    test('masks Aadhaar to XXXX-XXXX-last4', () => {
        const aadhaar = validAadhaar('23456789012');
        assert.equal(maskPii(`id ${aadhaar} please`), `id XXXX-XXXX-${aadhaar.slice(-4)} please`);
    });

    test('masks PAN and phone keeping the last 4 characters', () => {
        assert.equal(maskPii('PAN abcpe1234f'), 'PAN XXXXXX234F');
        assert.equal(maskPii('call +91 98765 43210 now'), 'call XXXXXX3210 now');
    });

    test('leaves text without PII unchanged', () => {
        const text = 'How do I update my Aadhaar address?';
        assert.equal(maskPii(text), text);
    });

    test('masked output is no longer detected', () => {
        const aadhaar = validAadhaar('98765432101');
        assert.deepEqual(findPii(maskPii(`${aadhaar} ABCPE1234F 9876543210`)), []);
    });
});

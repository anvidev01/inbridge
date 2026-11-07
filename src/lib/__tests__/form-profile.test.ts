import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { dateForField, formatDate, matchField, pickOption, usableProfile, withDerived, SENSITIVE_KEYS } from '../forms/profile';

describe('matchField', () => {
    const cases: Array<[string, string | null]> = [
        ['Applicant Name', 'full_name'],
        ['applicant_name', 'full_name'],
        ['txtFatherName', 'father_name'],
        ["Father's / Husband's Name", 'father_name'],
        ['Mother Name', 'mother_name'],
        ['Date of Birth (DD/MM/YYYY)', 'dob'],
        ['DOB', 'dob'],
        ['Sex', 'gender'],
        ['Aadhaar Number', 'aadhaar'],
        ['Mobile No.', 'phone'],
        ['E-mail ID', 'email'],
        ['PIN Code', 'pincode'],
        ['District', 'district'],
        ['State', 'state'],
        ['Village/Town', 'village_city'],
        ['Permanent Address', 'address'],
        ['Annual Income', 'annual_income'],
        ['Bank Account No', 'bank_account'],
        ['IFSC Code', 'ifsc'],
        ['Signature of Applicant', null],
        ['Photograph', null],
        ['आवेदक का नाम', 'full_name'],
        ['जन्म तिथि', 'dob'],
    ];
    for (const [field, expected] of cases) {
        test(`"${field}" -> ${expected}`, () => assert.equal(matchField(field), expected));
    }
});

describe('dates and options', () => {
    test('formats dd/mm/yyyy', () => assert.equal(formatDate('1990-04-07'), '07/04/1990'));
    test('box-per-character date fields get ddmmyyyy', () => assert.equal(dateForField('1990-04-07', 8), '07041990'));
    test('Female is not matched by "male"', () => {
        assert.equal(pickOption('female', ['Male', 'Female', 'Other']), 'Female');
        assert.equal(pickOption('male', ['Male', 'Female']), 'Male');
    });
    test('Hindi options match', () => assert.equal(pickOption('female', ['पुरुष', 'महिला']), 'महिला'));
    test('no match returns null', () => assert.equal(pickOption('male', ['Yes', 'No']), null));
});

describe('privacy defaults', () => {
    test('identity numbers are dropped unless switched on', () => {
        const profile = { full_name: 'Asha Devi', aadhaar: '123412341234', phone: '9999999999', pan: 'ABCDE1234F' };
        assert.deepEqual(usableProfile(profile, new Set()), { full_name: 'Asha Devi' });
        assert.deepEqual(usableProfile(profile, new Set(['phone'] as const)), { full_name: 'Asha Devi', phone: '9999999999' });
    });
    test('Aadhaar, PAN, bank account, phone, email, IFSC are all sensitive', () => {
        for (const k of ['aadhaar', 'pan', 'bank_account', 'phone', 'email', 'ifsc'] as const) assert.ok(SENSITIVE_KEYS.has(k), k);
    });
    test('derives first/last name and age', () => {
        const d = withDerived({ full_name: 'Asha Kumari Devi', dob: '2000-01-01' });
        assert.equal(d.first_name, 'Asha');
        assert.equal(d.last_name, 'Devi');
        assert.equal(d.middle_name, 'Kumari');
        assert.ok(Number(d.age) >= 25);
    });
});

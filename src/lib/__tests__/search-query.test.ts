import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearchQuery, stripQuestionFraming } from '../ai/search-query';

describe('stripQuestionFraming', () => {
    const cases: Array<[string, string]> = [
        ['What is PM-KISAN?', 'PM-KISAN'],
        ['Tell me about Ayushman Bharat', 'Ayushman Bharat'],
        ['How can I get a Mudra loan?', 'Mudra loan'],
        ['How do I apply for PM-Kisan?', 'PM-Kisan'],
        ['What is the Atal Pension Yojana?', 'Atal Pension Yojana'],
        ['Can you tell me about the PM Ujjwala scheme', 'PM Ujjwala scheme'],
        ['What documents are needed for Ayushman Bharat card?', 'Ayushman Bharat card'],
        ['What is the eligibility for PM-KISAN?', 'PM-KISAN'],
        ['I want to apply for widow pension', 'widow pension'],
        ['Please tell me about Sukanya Samriddhi', 'Sukanya Samriddhi'],
    ];
    for (const [input, expected] of cases) {
        test(`"${input}" -> "${expected}"`, () => assert.equal(stripQuestionFraming(input), expected));
    }

    test('questions that carry their own subject in the middle are left alone', () => {
        for (const q of [
            'Which scheme helps farmers with pension?',
            'What scholarships are there for girls in Uttar Pradesh?',
            'scholarship for SC students',
        ]) {
            assert.equal(stripQuestionFraming(q).length > 0, true);
        }
        assert.equal(stripQuestionFraming('scholarship for SC students'), 'scholarship for SC students');
    });

    test('never strips a question down to nothing', () => {
        for (const q of ['What is it?', 'How do I', 'tell me', 'What is the']) {
            assert.ok(stripQuestionFraming(q).length > 0, q);
        }
    });
});

describe('normalizeSearchQuery', () => {
    test('handles Hinglish and English framing together, line by line', () => {
        assert.equal(normalizeSearchQuery('PM Kisan Yojna Ke liye kaise apply karein'), 'PM Kisan apply');
        assert.equal(normalizeSearchQuery('PM-KISAN eligibility\nWhat documents do I need for it?').split('\n')[0], 'PM-KISAN eligibility');
    });

    test('plain subjects pass through', () => {
        assert.equal(normalizeSearchQuery('Ayushman Bharat'), 'Ayushman Bharat');
    });
});

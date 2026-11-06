import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { coversIntent, detectIntents, isRelevantDoc, planRetrieval } from '../retrieval-plan';

const summaryOnly = (title: string) => ({
    title,
    content: `${title}\n\nA short summary of the scheme.\n\nISSUING BODY: Some Ministry\nLEVEL: State\nOFFICIAL PAGE: https://www.myscheme.gov.in/schemes/x`,
});
const withSteps = (title: string) => ({
    title,
    content: `${title} gives Rs 6000 a year.\n\nELIGIBILITY:\n- farmers\n\nREQUIRED DOCUMENTS:\n- Aadhaar\n\nAPPLICATION PROCESS:\n1. Register\n\nOFFICIAL PORTAL: https://pmkisan.gov.in\nHELPLINE: 155261`,
});

describe('detectIntents (the user\'s own words, any of the three languages)', () => {
    test('English', () => {
        assert.deepEqual(detectIntents('How do I apply for PM-Kisan?'), ['apply']);
        assert.deepEqual(detectIntents('What documents are needed for a passport?'), ['documents']);
        assert.deepEqual(detectIntents('What is the eligibility for Ayushman Bharat?'), ['eligibility']);
        assert.deepEqual(detectIntents('How much money do I get?'), ['amount']);
        assert.deepEqual(detectIntents('Tell me about Ayushman Bharat'), []);
        assert.deepEqual(detectIntents('What is PM-KISAN?'), []);
    });

    test('Hinglish', () => {
        assert.ok(detectIntents('PM Kisan Yojna Ke liye kaise apply karein').includes('apply'));
        assert.ok(detectIntents('vidhwa pension kaise milegi').includes('apply'));
        assert.ok(detectIntents('passport ke liye kya documents chahiye').includes('documents'));
        assert.ok(detectIntents('Sukanya Samriddhi Yojana kaise khulwaye').includes('apply'));
        assert.ok(detectIntents('PM Kisan ka paisa kitna milega').includes('amount'));
    });

    test('Hindi', () => {
        assert.ok(detectIntents('पीएम किसान योजना के लिए आवेदन कैसे करें').includes('apply'));
        assert.ok(detectIntents('पासपोर्ट के लिए कौन से दस्तावेज़ चाहिए').includes('documents'));
        assert.ok(detectIntents('पात्रता क्या है').includes('eligibility'));
        assert.deepEqual(detectIntents('पीएम किसान क्या है'), []);
    });

    test('status checks are their own intent', () => {
        assert.ok(detectIntents('How do I check my PM Kisan status?').includes('status'));
    });
});

describe('coversIntent', () => {
    test('only the two curated entries have steps, documents and eligibility', () => {
        const full = withSteps('PM-KISAN').content;
        const thin = summaryOnly('Some Scheme').content;
        for (const intent of ['apply', 'documents', 'eligibility', 'contact'] as const) {
            assert.equal(coversIntent(full, intent), true, intent);
            assert.equal(coversIntent(thin, intent), false, intent);
        }
        assert.equal(coversIntent(full, 'amount'), true);
        assert.equal(coversIntent(thin, 'amount'), false);
    });

    test('no snapshot can say where someone\'s own application stands', () => {
        assert.equal(coversIntent(withSteps('PM-KISAN').content, 'status'), false);
    });
});

describe('isRelevantDoc', () => {
    test('an entry is about the question when its title carries the subject', () => {
        assert.equal(isRelevantDoc('Uttar Pradesh scholarship', summaryOnly('General Pre Matric Scholarship-Uttar Pradesh')), true);
        assert.equal(isRelevantDoc('PM-Kisan', withSteps('Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)')), true);
        assert.equal(isRelevantDoc('Mudra loan', summaryOnly('Pradhan Mantri Mudra Yojana')), true); // "loan" is a category word
    });

    test('one shared word out of two names is not enough', () => {
        assert.equal(isRelevantDoc('Sukanya Samriddhi', summaryOnly('Savitribai Phule Kishori Samriddhi Yojana')), false);
        assert.equal(isRelevantDoc('Sukanya Samriddhi', summaryOnly('Samriddhi – Scheme for Scheduled Caste Students')), false);
    });

    test('a word mentioned deep in a long description does not count', () => {
        const aadhaar = {
            title: 'Aadhaar (UIDAI Identity Service)',
            content: 'Aadhaar is a unique identity number issued to residents of India by UIDAI.' + ' '.repeat(120) + 'accepted proofs: voter ID, passport',
        };
        assert.equal(isRelevantDoc('voter ID card', aadhaar), false);
    });

    test('plurals match', () => {
        assert.equal(isRelevantDoc('scholarships', summaryOnly('Post-matric Scholarship Scheme')), true);
    });

    test('a question with no distinctive words cannot be judged, so it is not rejected', () => {
        assert.equal(isRelevantDoc('where to apply', summaryOnly('Anything')), true);
    });
});

describe('planRetrieval', () => {
    test('the snapshot answers a plain "what is" about a scheme it has', () => {
        const plan = planRetrieval('Atal Pension Yojana', [summaryOnly('Atal Pension Yojana')], []);
        assert.deepEqual([plan.needsLive, plan.reason], [false, 'dataset-answers']);
    });

    test('the snapshot answers "how do I apply" only when the entry has the steps', () => {
        const curated = planRetrieval('PM-Kisan', [withSteps('Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)')], ['apply']);
        assert.deepEqual([curated.needsLive, curated.reason], [false, 'dataset-answers']);

        const thin = planRetrieval('Uttar Pradesh scholarship', [summaryOnly('Post-matric Scholarship Scheme- Uttar Pradesh')], ['apply']);
        assert.deepEqual([thin.needsLive, thin.reason], [true, 'missing-details']);
        assert.deepEqual(thin.relevant, [0], 'the scheme entry still goes along as context');
    });

    test('a scheme that is not in the snapshot goes live', () => {
        const plan = planRetrieval('Sukanya Samriddhi', [summaryOnly('Savitribai Phule Kishori Samriddhi Yojana'), summaryOnly('Samriddhi Scheme for SC Students')], []);
        assert.deepEqual([plan.needsLive, plan.reason, plan.relevant], [true, 'nothing-relevant', []]);
    });

    test('no hits at all goes live', () => {
        assert.equal(planRetrieval('PAN card', [], ['apply']).needsLive, true);
    });

    test('every asked-for detail must be covered', () => {
        const partial = { title: 'PM-KISAN', content: 'PM-KISAN\n\nAPPLICATION PROCESS:\n1. Register\nISSUING BODY: x' }; // steps, but no documents section
        assert.equal(planRetrieval('PM-KISAN', [partial], ['apply']).needsLive, false);
        assert.equal(planRetrieval('PM-KISAN', [partial], ['apply', 'documents']).needsLive, true);
    });

    test('checking a status always goes live', () => {
        assert.equal(planRetrieval('PM-KISAN', [withSteps('PM-KISAN')], ['status']).needsLive, true);
    });
});

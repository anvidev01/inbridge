import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractChecklist, extractComplaintDraft } from '../answer/sections';

describe('extractChecklist', () => {
    test('reads bullets under a "Documents needed" heading', () => {
        const md = [
            'PM-KISAN supports farmers [1].',
            '',
            '### Documents needed',
            '- **Aadhaar** card [1]',
            '- Land records',
            '',
            '* Bank account details',
            '',
            '### How to apply',
            '- Visit the portal',
        ].join('\n');
        assert.deepEqual(extractChecklist(md), {
            heading: 'Documents needed',
            items: ['Aadhaar card', 'Land records', 'Bank account details'],
        });
    });

    test('accepts a bold heading, a lead-in line and numbered items', () => {
        const md = '**Required documents:**\nKeep these ready:\n1. Aadhaar\n2) Ration card';
        assert.deepEqual(extractChecklist(md)?.items, ['Aadhaar', 'Ration card']);
    });

    test('accepts the Hindi heading', () => {
        const md = '## आवश्यक दस्तावेज़\n- आधार कार्ड\n- बैंक पासबुक';
        assert.deepEqual(extractChecklist(md)?.items, ['आधार कार्ड', 'बैंक पासबुक']);
    });

    test('folds nested bullets into their parent', () => {
        const md = '## Documents required\n- Identity proof (any one):\n  - Aadhaar\n  - Voter ID\n- Photo';
        assert.deepEqual(extractChecklist(md)?.items, ['Identity proof (any one): Aadhaar, Voter ID', 'Photo']);
    });

    test('stops at the first paragraph after the list', () => {
        const md = '## Documents needed\n- Aadhaar\n\nYou can apply online.\n- Not a document';
        assert.deepEqual(extractChecklist(md)?.items, ['Aadhaar']);
    });

    test('returns null without a matching heading or without items', () => {
        assert.equal(extractChecklist('- Aadhaar\n- PAN'), null);
        assert.equal(extractChecklist('## Documents needed\nCheck the official page.'), null);
        assert.equal(extractChecklist('- **Documents required:** Aadhaar, PAN'), null);
    });
});

describe('extractComplaintDraft', () => {
    test('takes the section up to the next heading of the same level', () => {
        const md = [
            'Here is your draft.',
            '## Draft complaint',
            '**Subject:** PM-KISAN instalment not received',
            '',
            'Respected Sir/Madam, I have not received the instalment.',
            '### Details',
            'Registration number: (fill in)',
            '## Next steps',
            'Submit it on CPGRAMS.',
        ].join('\n');
        assert.equal(
            extractComplaintDraft(md),
            'Subject: PM-KISAN instalment not received\n\nRespected Sir/Madam, I have not received the instalment.\nDetails\nRegistration number: (fill in)'
        );
    });

    test('takes a fenced block as-is', () => {
        const md = '**Draft complaint:**\n```\nTo the Grievance Officer,\n**Subject:** delay\n```\n---\nMore';
        assert.equal(extractComplaintDraft(md), 'To the Grievance Officer,\n**Subject:** delay');
    });

    test('recognises the Hindi heading', () => {
        assert.equal(extractComplaintDraft('## शिकायत का ड्राफ्ट\nमहोदय,'), 'महोदय,');
    });

    test('returns null when there is no draft', () => {
        assert.equal(extractComplaintDraft('## How to file a complaint\nVisit pgportal.gov.in'), null);
    });
});

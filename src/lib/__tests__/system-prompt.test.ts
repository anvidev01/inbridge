import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt, SECTION_HEADINGS } from '../ai/system-prompt';
import { extractChecklist, extractComplaintDraft } from '../answer/sections';
import type { Language } from '../chat/protocol';

const LANGS: Language[] = ['en', 'hi', 'hinglish'];

describe('grievance prompt headings the client keys off', () => {
    test('asks for "## Draft complaint" and "Documents needed" in English and Hinglish', () => {
        for (const language of ['en', 'hinglish'] as const) {
            const p = buildSystemPrompt({ language, mode: 'grievance', focus: 'all', sources: [] });
            assert.match(p, /written exactly as: ## Draft complaint$/m, language);
            assert.match(p, /written exactly as: ### Documents needed$/m, language);
        }
    });

    test('asks for "## शिकायत का ड्राफ्ट" and "आवश्यक दस्तावेज" in Hindi', () => {
        const p = buildSystemPrompt({ language: 'hi', mode: 'grievance', focus: 'all', sources: [] });
        assert.match(p, /written exactly as: ## शिकायत का ड्राफ्ट$/m);
        assert.match(p, /written exactly as: ### आवश्यक दस्तावेज$/m);
    });

    test('default mode asks for the documents heading too', () => {
        for (const language of LANGS) {
            const p = buildSystemPrompt({ language, mode: 'default', focus: 'all', sources: [] });
            assert.ok(p.includes(`written exactly as: ${SECTION_HEADINGS[language].documents}`), language);
            assert.ok(!p.includes(SECTION_HEADINGS[language].draft), `${language}: no draft heading outside grievance mode`);
        }
    });

    test('a reply that follows the prompt is picked up by the client extractors', () => {
        for (const language of LANGS) {
            const { draft, documents } = SECTION_HEADINGS[language];
            const reply = [
                draft,
                '**Subject:** Pension not credited',
                '**Department / scheme:** NSAP',
                '**Details of the grievance:** My pension stopped in March.',
                '---',
                documents,
                '- Pension sanction letter',
                '- Bank passbook copy',
                '',
                'InBridge does not file this complaint for you.',
            ].join('\n');

            const extracted = extractComplaintDraft(reply);
            assert.ok(extracted, `${language}: draft found`);
            assert.match(extracted, /Pension not credited/);
            assert.doesNotMatch(extracted, /does not file/, `${language}: hand-off note is not part of the draft`);
            assert.doesNotMatch(extracted, /passbook/, `${language}: documents are not part of the draft`);

            assert.deepEqual(extractChecklist(reply)?.items, ['Pension sanction letter', 'Bank passbook copy'], language);
        }
    });
});

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

describe('punctuation rule', () => {
    test('every language is told not to use em or en dashes', () => {
        for (const language of ['en', 'hi', 'hinglish'] as const) {
            for (const mode of ['default', 'grievance'] as const) {
                const prompt = buildSystemPrompt({ language, mode, focus: 'all', sources: [] });
                assert.match(prompt, /Never use em dashes \(\u2014\) or en dashes \(\u2013\)/, `${language}/${mode}`);
            }
        }
    });
});

describe('prompt does not confuse "how do I apply" with "can you apply for me"', () => {
    const prompt = buildSystemPrompt({ language: 'en', mode: 'default', focus: 'all', sources: [] });

    test('the "not official" line is conditional and never a reply opener', () => {
        assert.match(prompt, /Only when the user asks whether InBridge is official/);
        assert.match(prompt, /never begin a reply with a disclaimer/i);
        assert.doesNotMatch(prompt, /If asked whether you are official/);
    });

    test("how-to questions are answered; refusal is reserved for acting on the user's behalf", () => {
        assert.match(prompt, /"how do I apply for X"[^.]*asks YOU to explain the process/);
        assert.match(prompt, /Only if the user asks InBridge itself to act for them/);
        assert.doesNotMatch(prompt, /InBridge cannot apply for anything, check an application's status or file complaints for the user\./);
    });

    test('answers must start with the answer, not "No"', () => {
        assert.match(prompt, /Do not begin with "No"/);
    });
});

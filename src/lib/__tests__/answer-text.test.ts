import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Citation } from '../chat/protocol';
import { buildCopyText, buildShareText, cleanAnswerText, stripMarkdown, truncate, whatsappShareUrl } from '../answer/text';
import { pickVoice, speechChunks, toSpeechText } from '../answer/speech';
import { formatDateTime, formatTime } from '../answer/format';

const SOURCES: Citation[] = [
    { n: 1, title: 'PM-KISAN', url: 'https://pmkisan.gov.in/', host: 'pmkisan.gov.in', official: true },
    { n: 2, title: 'myScheme', url: 'https://www.myscheme.gov.in/schemes/pm-kisan', host: 'myscheme.gov.in', official: true },
];

describe('cleanAnswerText', () => {
    test('drops a legacy SOURCES block', () => {
        assert.equal(cleanAnswerText('---SOURCES---\n[{"title":"x"}]\n---END_SOURCES---\nHello'), 'Hello');
    });

    test('hides a still-streaming SOURCES block', () => {
        assert.equal(cleanAnswerText('Intro ---SOURCES---\n[{"ti'), 'Intro');
    });

    test('cuts a FOLLOWUPS block, including a partial marker', () => {
        assert.equal(cleanAnswerText('Answer\n---FOLLOWUPS---\n["a"]'), 'Answer');
        assert.equal(cleanAnswerText('Answer\n---FOLL'), 'Answer');
    });

    test('keeps ordinary horizontal rules', () => {
        assert.equal(cleanAnswerText('A\n\n---\n\nB'), 'A\n\n---\n\nB');
    });
});

describe('stripMarkdown', () => {
    test('removes headings, emphasis, list markers and links', () => {
        const md = '## Eligibility\n- **Small** farmers\n- See [the portal](https://pmkisan.gov.in)';
        assert.equal(stripMarkdown(md), 'Eligibility\nSmall farmers\nSee the portal');
    });

    test('can drop bare URLs', () => {
        assert.equal(stripMarkdown('Visit https://pmkisan.gov.in now', { dropUrls: true }), 'Visit now');
    });

    test('leaves snake_case words alone', () => {
        assert.equal(stripMarkdown('field_name value'), 'field_name value');
    });
});

describe('copy and share text', () => {
    test('copy keeps markers and appends a numbered source list', () => {
        assert.equal(
            buildCopyText('Farmers get support [1].', SOURCES),
            'Farmers get support [1].\n\nSources:\n[1] PM-KISAN: https://pmkisan.gov.in/\n[2] myScheme: https://www.myscheme.gov.in/schemes/pm-kisan'
        );
    });

    test('copy without sources is just the answer', () => {
        assert.equal(buildCopyText(' Hi ', []), 'Hi');
    });

    test('share text has a plain summary, source URLs and the footer', () => {
        const text = buildShareText('**PM-KISAN** gives support [1].', SOURCES, { footer: 'via InBridge https://inbridge.in' });
        assert.equal(
            text,
            'PM-KISAN gives support.\n\nSources:\nhttps://pmkisan.gov.in/\nhttps://www.myscheme.gov.in/schemes/pm-kisan\n\nvia InBridge https://inbridge.in'
        );
    });

    test('share summary is truncated at a word boundary', () => {
        assert.equal(truncate('one two three four', 10), 'one two…');
    });

    test('WhatsApp URL encodes the text', () => {
        assert.equal(whatsappShareUrl('a b&c'), 'https://wa.me/?text=a%20b%26c');
    });
});

describe('speech', () => {
    test('strips markdown, citations and URLs', () => {
        const md = '## Steps\n1. Visit https://pmkisan.gov.in [1]\n2. Click **Register**';
        assert.equal(toSpeechText(md), 'Steps. 1. Visit. 2. Click Register');
    });

    test('chunks long text on sentence boundaries', () => {
        const text = 'First sentence here. Second sentence here. Third one.';
        assert.deepEqual(speechChunks(text, 25), ['First sentence here.', 'Second sentence here.', 'Third one.']);
    });

    test('splits a single sentence that is longer than max', () => {
        const chunks = speechChunks('a '.repeat(50).trim(), 20);
        assert.ok(chunks.length > 1);
        assert.ok(chunks.every((c) => c.length <= 20));
    });

    test('chunks Hindi on the danda', () => {
        assert.deepEqual(speechChunks('पहला वाक्य। दूसरा वाक्य।', 12), ['पहला वाक्य।', 'दूसरा वाक्य।']);
    });

    test('pickVoice prefers an exact match, then the same language', () => {
        const voices = [
            { lang: 'en-US', name: 'US', voiceURI: 'us' },
            { lang: 'en_IN', name: 'IN', voiceURI: 'in' },
            { lang: 'hi-IN', name: 'HI', voiceURI: 'hi' },
        ];
        assert.equal(pickVoice(voices, 'en-IN')?.voiceURI, 'in');
        assert.equal(pickVoice(voices.slice(0, 1), 'en-IN')?.voiceURI, 'us');
        assert.equal(pickVoice(voices, 'hi-IN')?.voiceURI, 'hi');
    });

    test('pickVoice returns undefined when no voice speaks the language', () => {
        assert.equal(pickVoice([{ lang: 'en-US', name: 'US', voiceURI: 'us' }], 'hi-IN'), undefined);
    });
});

describe('format', () => {
    test('formats a time and hides a missing one', () => {
        const ms = Date.UTC(2026, 10, 1, 10, 5);
        assert.match(formatTime(ms, 'en-IN', 'Asia/Kolkata'), /^3:35\s?pm$/i);
        assert.equal(formatTime(undefined, 'en-IN'), '');
    });

    test('formats an ISO date-time and rejects junk', () => {
        assert.match(formatDateTime('2026-11-01T10:05:00Z', 'en-IN', 'Asia/Kolkata'), /1 Nov 2026/);
        assert.equal(formatDateTime('nope', 'en-IN'), '');
    });
});

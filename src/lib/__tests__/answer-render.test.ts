import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Citation, InBridgeUIMessage } from '../chat/protocol';
import { citationsKey, classifyLink, hastText } from '../answer/markdown';
import { anchorOffscreen, popoverPosition } from '../answer/popover';
import { answerContext, isStoppedAnswer } from '../answer/message';

const SOURCES: Citation[] = [
    { n: 1, title: 'PM-KISAN', url: 'https://pmkisan.gov.in/', host: 'pmkisan.gov.in', official: true },
    { n: 2, title: 'Explainer', url: 'https://example.org/pm-kisan', host: 'example.org', official: false },
];

describe('hastText', () => {
    test('joins nested text nodes (formatted link labels)', () => {
        const node = {
            type: 'element',
            children: [
                { type: 'text', value: 'Visit ' },
                { type: 'element', children: [{ type: 'text', value: 'pmkisan.gov.in' }] },
            ],
        };
        assert.equal(hastText(node), 'Visit pmkisan.gov.in');
    });

    test('handles missing nodes', () => {
        assert.equal(hastText(undefined), '');
        assert.equal(hastText({ type: 'element' }), '');
    });
});

describe('classifyLink', () => {
    const cited = new Set(['example.org']);

    test('tel/mailto/sms become plain text', () => {
        for (const href of ['tel:1800123', 'mailto:a@b.in', 'SMS:123']) {
            assert.deepEqual(classifyLink(href, 'x', cited), { kind: 'text' });
        }
    });

    test('relative links stay internal', () => {
        assert.deepEqual(classifyLink('/services/pm-kisan', 'x', cited), { kind: 'internal' });
        assert.deepEqual(classifyLink('#top', 'x', cited), { kind: 'internal' });
    });

    test('gov and nic hosts are external links', () => {
        assert.deepEqual(classifyLink('https://www.pmkisan.gov.in/x', 'PM-KISAN', cited), { kind: 'external', host: 'pmkisan.gov.in', showHost: true });
        assert.equal(classifyLink('https://x.nic.in/', 'x', cited).kind, 'external');
    });

    test('cited non-gov hosts are external links', () => {
        assert.equal(classifyLink('https://example.org/a', 'a', cited).kind, 'external');
    });

    test('uncited non-gov hosts are unverified', () => {
        assert.deepEqual(classifyLink('https://evil.example.com/a', 'click', cited), { kind: 'unverified', host: 'evil.example.com', showHost: true });
        assert.equal(classifyLink('https://gov.in.evil.com/', 'x', cited).kind, 'unverified');
    });

    test('host is not repeated when the label already contains it', () => {
        const d = classifyLink('https://pmkisan.gov.in/', 'Visit PMKISAN.gov.in', cited);
        assert.equal(d.kind, 'external');
        assert.equal(d.kind === 'external' && d.showHost, false);
    });
});

describe('citationsKey', () => {
    test('equal for cloned arrays, different when content changes', () => {
        assert.equal(citationsKey(SOURCES), citationsKey(structuredClone(SOURCES)));
        assert.notEqual(citationsKey(SOURCES), citationsKey(SOURCES.slice(0, 1)));
        assert.notEqual(citationsKey(SOURCES), citationsKey([{ ...SOURCES[0], url: 'https://pmkisan.gov.in/b' }, SOURCES[1]]));
        assert.equal(citationsKey([]), '[]');
    });
});

describe('popoverPosition', () => {
    test('below the chip when there is room, clamped to the viewport', () => {
        assert.deepEqual(popoverPosition({ top: 100, bottom: 120, left: 300 }, 360, 800, 288), { left: 64, width: 288, top: 126 });
    });

    test('flips above near the bottom', () => {
        assert.deepEqual(popoverPosition({ top: 700, bottom: 720, left: 20 }, 1024, 800, 288), { left: 20, width: 288, bottom: 106 });
    });

    test('narrow viewport shrinks width and keeps the margin', () => {
        assert.deepEqual(popoverPosition({ top: 10, bottom: 30, left: 0 }, 300, 800, 288), { left: 8, width: 284, top: 36 });
    });

    test('anchorOffscreen', () => {
        assert.equal(anchorOffscreen({ top: -40, bottom: -10, left: 0 }, 800), true);
        assert.equal(anchorOffscreen({ top: 810, bottom: 830, left: 0 }, 800), true);
        assert.equal(anchorOffscreen({ top: -5, bottom: 15, left: 0 }, 800), false);
    });
});

function assistant(parts: InBridgeUIMessage['parts'], metadata?: InBridgeUIMessage['metadata']): InBridgeUIMessage {
    return { id: 'm1', role: 'assistant', parts, metadata };
}

describe('answerContext', () => {
    test('prefers metadata over UI values', () => {
        const m = assistant([], { createdAt: 1, mode: 'grievance', language: 'hi' });
        assert.deepEqual(answerContext(m, { mode: 'default', language: 'en' }), { mode: 'grievance', language: 'hi' });
    });

    test('falls back to UI values per field', () => {
        assert.deepEqual(answerContext(assistant([]), { mode: 'default', language: 'en' }), { mode: 'default', language: 'en' });
        assert.deepEqual(
            answerContext(assistant([], { language: 'hinglish' }), { mode: 'grievance', language: 'en' }),
            { mode: 'grievance', language: 'hinglish' }
        );
    });
});

describe('isStoppedAnswer', () => {
    const text = { type: 'text' as const, text: 'Partial' };
    const followups = { type: 'data-followups' as const, id: 'followups', data: ['Next?'] };
    const done = { isLast: true, isStreaming: false, hasText: true };

    test('true when the last answer has no followups part', () => {
        assert.equal(isStoppedAnswer(assistant([text], { createdAt: 1 }), done), true);
    });

    test('false for a completed answer (server always sends followups)', () => {
        assert.equal(isStoppedAnswer(assistant([text, followups], { createdAt: 1 }), done), false);
    });

    test('false while streaming, when not last, or with no text', () => {
        const m = assistant([text], { createdAt: 1 });
        assert.equal(isStoppedAnswer(m, { ...done, isStreaming: true }), false);
        assert.equal(isStoppedAnswer(m, { ...done, isLast: false }), false);
        assert.equal(isStoppedAnswer(m, { ...done, hasText: false }), false);
    });

    test('false for legacy messages without createdAt metadata', () => {
        assert.equal(isStoppedAnswer(assistant([text]), done), false);
    });
});

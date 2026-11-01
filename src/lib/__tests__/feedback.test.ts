import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeedbackBody } from '../ai/feedback';

describe('parseFeedbackBody', () => {
    test('accepts a minimal vote', () => {
        assert.deepEqual(parseFeedbackBody({ messageId: 'abc_123-X', rating: 'up' }), {
            ok: true,
            value: { messageId: 'abc_123-X', rating: 'up' },
        });
    });

    test('accepts a full body and dedupes arrays', () => {
        const r = parseFeedbackBody({
            messageId: 'm1',
            rating: 'down',
            reasons: ['outdated', 'broken_link', 'outdated'],
            note: '  link 404s  ',
            sourceType: 'tavily_search',
            citationHosts: ['pmkisan.gov.in', 'pmkisan.gov.in', 'myscheme.gov.in'],
        });
        assert.ok(r.ok);
        assert.deepEqual(r.value, {
            messageId: 'm1',
            rating: 'down',
            reasons: ['outdated', 'broken_link'],
            note: 'link 404s',
            sourceType: 'tavily_search',
            citationHosts: ['pmkisan.gov.in', 'myscheme.gov.in'],
        });
    });

    test('masks PII in the note', () => {
        const r = parseFeedbackBody({ messageId: 'm1', rating: 'down', note: 'call me on 9876543210' });
        assert.ok(r.ok);
        assert.equal(r.value.note, 'call me on XXXXXX3210');
    });

    test('rejects unknown fields, so query text cannot sneak in', () => {
        assert.equal(parseFeedbackBody({ messageId: 'm1', rating: 'up', query: 'my question' }).ok, false);
        assert.equal(parseFeedbackBody({ messageId: 'm1', rating: 'up', answer: 'text' }).ok, false);
    });

    const invalid: Array<[string, unknown]> = [
        ['non-object', 'up'],
        ['array', []],
        ['missing messageId', { rating: 'up' }],
        ['messageId with spaces', { messageId: 'a b', rating: 'up' }],
        ['messageId too long', { messageId: 'a'.repeat(129), rating: 'up' }],
        ['bad rating', { messageId: 'm', rating: 'meh' }],
        ['unknown reason', { messageId: 'm', rating: 'down', reasons: ['spam'] }],
        ['reasons not array', { messageId: 'm', rating: 'down', reasons: 'outdated' }],
        ['note too long', { messageId: 'm', rating: 'down', note: 'x'.repeat(301) }],
        ['note not string', { messageId: 'm', rating: 'down', note: 5 }],
        ['bad sourceType', { messageId: 'm', rating: 'up', sourceType: 'google' }],
        ['bad host', { messageId: 'm', rating: 'up', citationHosts: ['https://x.gov.in/'] }],
        ['too many hosts', { messageId: 'm', rating: 'up', citationHosts: Array.from({ length: 21 }, (_, i) => `h${i}.gov.in`) }],
    ];
    for (const [name, body] of invalid) {
        test(`rejects ${name}`, () => {
            assert.equal(parseFeedbackBody(body).ok, false);
        });
    }

    test('accepts a note of exactly 300 characters', () => {
        assert.ok(parseFeedbackBody({ messageId: 'm', rating: 'down', note: 'x'.repeat(300) }).ok);
    });
});

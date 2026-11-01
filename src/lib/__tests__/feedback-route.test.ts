import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { feedbackLanguage } from '../ai/feedback';
import { resetRateLimits } from '../ai/ratelimit';

/** A request whose body must never be read. */
function unreadable(url: string, headers: Record<string, string>): Request {
    let read = false;
    const req = {
        url,
        headers: new Headers({ 'x-forwarded-for': '7.7.7.7', ...headers }),
        text: async () => {
            read = true;
            throw new Error('body was read');
        },
        get bodyWasRead() {
            return read;
        },
    };
    return req as unknown as Request;
}

async function post(url: string, body: string, headers: Record<string, string> = {}) {
    const { POST } = await import('../../app/api/feedback/route');
    return POST(
        new Request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '7.7.7.7', ...headers },
            body,
        })
    );
}

describe('POST /api/feedback', () => {
    beforeEach(() => resetRateLimits());

    test('rejects an oversized content-length without reading the body', async () => {
        const { POST } = await import('../../app/api/feedback/route');
        const req = unreadable('http://localhost/api/feedback', { 'content-length': String(1024 * 1024) });
        const res = await POST(req);
        assert.equal(res.status, 400);
        assert.equal((await res.json()).code, 'bad_request');
        assert.equal((req as unknown as { bodyWasRead: boolean }).bodyWasRead, false);
    });

    test('still rejects a large body when content-length is missing or understated', async () => {
        const res = await post('http://localhost/api/feedback', JSON.stringify({ messageId: 'm1', rating: 'up', note: 'x'.repeat(5000) }));
        assert.equal(res.status, 400);
    });

    test('accepts a valid vote with 204', async () => {
        const res = await post('http://localhost/api/feedback', JSON.stringify({ messageId: 'm1', rating: 'up' }));
        assert.equal(res.status, 204);
    });

    test('error copy follows ?lang=', async () => {
        const res = await post('http://localhost/api/feedback?lang=hi', '{not json');
        assert.equal(res.status, 400);
        assert.match((await res.json()).message, /[ऀ-ॿ]/);
    });

    test('error copy follows Accept-Language when there is no ?lang=', async () => {
        const res = await post('http://localhost/api/feedback', '{not json', { 'Accept-Language': 'hi-IN,hi;q=0.9,en;q=0.8' });
        assert.match((await res.json()).message, /[ऀ-ॿ]/);
    });

    test('defaults to English', async () => {
        const res = await post('http://localhost/api/feedback', '{not json');
        assert.match((await res.json()).message, /^Something was wrong/);
    });
});

describe('feedbackLanguage', () => {
    test('a valid ?lang= wins over Accept-Language', () => {
        assert.equal(feedbackLanguage('http://x/api/feedback?lang=hinglish', 'hi-IN'), 'hinglish');
    });

    test('an invalid ?lang= is ignored', () => {
        assert.equal(feedbackLanguage('http://x/api/feedback?lang=fr', null), 'en');
        assert.equal(feedbackLanguage('http://x/api/feedback?lang=fr', 'hi'), 'hi');
    });

    test('reads Accept-Language by weight', () => {
        assert.equal(feedbackLanguage('http://x/', 'en;q=0.5, hi;q=0.9'), 'hi');
        assert.equal(feedbackLanguage('http://x/', 'hi-Latn'), 'hinglish');
        assert.equal(feedbackLanguage('http://x/', 'fr-FR, en-IN;q=0.8'), 'en');
        assert.equal(feedbackLanguage('http://x/', 'fr-FR'), 'en');
    });

    test('tolerates a malformed URL', () => {
        assert.equal(feedbackLanguage('not a url', 'hi'), 'hi');
    });
});

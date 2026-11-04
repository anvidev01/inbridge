import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildTavilyRecord, trackTavilyUsage } from '../observability/tavily-usage';

describe('buildTavilyRecord', () => {
    test('captures credits, result count and request id on success', () => {
        const rec = buildTavilyRecord({
            startedAt: Date.now() - 250,
            searchDepth: 'advanced',
            response: { results: [{}, {}], usage: { credits: 2 }, requestId: 'req-1' },
        });
        assert.equal(rec.success, true);
        assert.equal(rec.credits, 2);
        assert.equal(rec.result_count, 2);
        assert.equal(rec.request_id, 'req-1');
        assert.ok(rec.latency_ms >= 250);
        assert.equal(rec.error_kind, undefined);
    });

    test('defaults credits to 0 when usage is absent', () => {
        const rec = buildTavilyRecord({ startedAt: Date.now(), searchDepth: 'advanced', response: { results: [] } });
        assert.equal(rec.credits, 0);
        assert.equal(rec.result_count, 0);
    });

    test('classifies failures', () => {
        const rec = buildTavilyRecord({ startedAt: Date.now(), searchDepth: 'advanced', error: new Error('429 rate limit') });
        assert.equal(rec.success, false);
        assert.equal(rec.error_kind, 'rate_limit');
        assert.equal(rec.credits, 0);
    });
});

describe('trackTavilyUsage', () => {
    test('never throws, even without env or request scope', () => {
        const env = { ...process.env };
        delete process.env.INTERNAL_API_TOKEN;
        assert.doesNotThrow(() =>
            trackTavilyUsage({ success: true, credits: 1, latency_ms: 10, result_count: 1 }),
        );
        process.env = env;
    });
});

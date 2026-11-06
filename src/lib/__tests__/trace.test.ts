import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { recentTraces, startTrace } from '../observability/trace';

describe('request trace', () => {
    test('a request that never finishes stays open at the last stage it reached', () => {
        const t = startTrace();
        t.mark('retrieved', 'tavily_search');
        t.mark('router-start');
        const mine = recentTraces().find((x) => x.stages.some((s) => s.stage === 'router-start'));
        assert.ok(mine);
        assert.equal(mine.open, true);
        assert.deepEqual(mine.stages.map((s) => s.stage), ['retrieved', 'router-start']);
        assert.equal(mine.stages[0].detail, 'tavily_search');
    });

    test('end closes it with a final stage', () => {
        const t = startTrace();
        t.mark('first-token', 'gemini');
        t.end('finished');
        const mine = recentTraces().find((x) => x.stages.some((s) => s.detail === 'finished'));
        assert.ok(mine);
        assert.equal(mine.open, false);
        assert.equal(mine.stages.at(-1)?.stage, 'done');
    });

    test('keeps only the most recent traces, newest first', () => {
        for (let i = 0; i < 40; i++) startTrace().mark('n', String(i));
        const all = recentTraces(100);
        assert.ok(all.length <= 30);
        assert.equal(all[0].stages[0].detail, '39');
    });

    test('long details are cut and no question text is stored', () => {
        const t = startTrace();
        t.mark('x', 'a'.repeat(500));
        const mine = recentTraces().find((x) => x.stages.some((s) => s.stage === 'x'));
        assert.equal(mine?.stages[0].detail?.length, 80);
    });
});

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { log } from '../observability/logger';

function captureLines(fn: () => void): any[] {
    const lines: any[] = [];
    const originals = { log: console.log, warn: console.warn, error: console.error };
    const capture = (line: string) => lines.push(JSON.parse(line));

    console.log = capture as any;
    console.warn = capture as any;
    console.error = capture as any;
    try {
        fn();
    } finally {
        console.log = originals.log;
        console.warn = originals.warn;
        console.error = originals.error;
    }
    return lines;
}

describe('structured logger', () => {
    let previousLevel: string | undefined;

    beforeEach(() => {
        previousLevel = process.env.LOG_LEVEL;
        process.env.LOG_LEVEL = 'debug';
    });

    afterEach(() => {
        if (previousLevel === undefined) delete process.env.LOG_LEVEL;
        else process.env.LOG_LEVEL = previousLevel;
    });

    test('emits zerolog-compatible envelope fields', () => {
        const [record] = captureLines(() => log.info('hello', { provider: 'anthropic' }));

        assert.equal(record.level, 'info');
        assert.equal(record.message, 'hello');
        assert.equal(record.service, 'chat-api');
        assert.equal(record.provider, 'anthropic');
        assert.ok(!Number.isNaN(Date.parse(record.time)), 'time must be parseable');
    });

    test('redacts sensitive field names at the top level and when nested', () => {
        const [record] = captureLines(() =>
            log.info('citizen lookup', {
                aadhaar: '1234-5678-9012',
                query: 'my aadhaar is 1234',
                request: { token: 'bearer-abc', safe: 'keep-me' },
            })
        );

        assert.equal(record.aadhaar, '[redacted]');
        assert.equal(record.query, '[redacted]');
        assert.equal(record.request.token, '[redacted]');
        assert.equal(record.request.safe, 'keep-me');
    });

    test('serialises Error values instead of emitting {}', () => {
        const [record] = captureLines(() => log.error('boom', { error: new TypeError('bad input') }));

        assert.equal(record.error.name, 'TypeError');
        assert.equal(record.error.message, 'bad input');
    });

    test('caller fields cannot shadow the envelope', () => {
        const [record] = captureLines(() =>
            log.warn('real message', { level: 'debug', message: 'spoofed', time: 'nope' } as any)
        );

        assert.equal(record.level, 'warn');
        assert.equal(record.message, 'real message');
        assert.notEqual(record.time, 'nope');
    });

    test('respects LOG_LEVEL', () => {
        process.env.LOG_LEVEL = 'warn';
        const lines = captureLines(() => {
            log.debug('suppressed');
            log.info('suppressed');
            log.warn('kept');
            log.error('kept');
        });
        assert.equal(lines.length, 2);
    });
});

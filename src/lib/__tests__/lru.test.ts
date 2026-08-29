import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { LRUCache, queryCacheKey } from '../cache/lru';

describe('LRUCache', () => {
    test('returns stored values and counts hits and misses', () => {
        const cache = new LRUCache<string>(10, 60_000);

        assert.equal(cache.get('absent'), undefined);
        cache.set('a', 'alpha');
        assert.equal(cache.get('a'), 'alpha');

        const stats = cache.stats();
        assert.equal(stats.hits, 1);
        assert.equal(stats.misses, 1);
    });

    test('evicts the least-recently-used entry, not the oldest inserted', () => {
        const cache = new LRUCache<number>(2, 60_000);

        cache.set('a', 1);
        cache.set('b', 2);

        // Touching 'a' must make 'b' the eviction candidate.
        assert.equal(cache.get('a'), 1);
        cache.set('c', 3);

        assert.equal(cache.get('a'), 1, 'recently used entry should survive');
        assert.equal(cache.get('b'), undefined, 'least-recently-used entry should be evicted');
        assert.equal(cache.get('c'), 3);
        assert.equal(cache.stats().evictions, 1);
    });

    test('expires entries past their TTL and counts the expiry', () => {
        const cache = new LRUCache<string>(10, 0); // everything is immediately stale
        cache.set('a', 'alpha');

        assert.equal(cache.get('a'), undefined);
        const stats = cache.stats();
        assert.equal(stats.expirations, 1);
        assert.equal(stats.misses, 1);
        assert.equal(stats.size, 0, 'expired entry should be dropped, not retained');
    });

    test('overwriting a key refreshes recency rather than duplicating it', () => {
        const cache = new LRUCache<number>(2, 60_000);
        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('a', 99); // refresh 'a'
        cache.set('c', 3);  // should evict 'b'

        assert.equal(cache.get('a'), 99);
        assert.equal(cache.get('b'), undefined);
        assert.equal(cache.stats().size, 2);
    });

    test('never exceeds maxEntries', () => {
        const cache = new LRUCache<number>(3, 60_000);
        for (let i = 0; i < 50; i++) cache.set(`k${i}`, i);
        assert.equal(cache.stats().size, 3);
    });
});

describe('queryCacheKey', () => {
    test('collapses case, whitespace and trailing punctuation', () => {
        assert.equal(
            queryCacheKey('  PM   Kisan   Status? '),
            queryCacheKey('pm kisan status')
        );
    });

    test('keeps genuinely different queries distinct', () => {
        assert.notEqual(queryCacheKey('pm kisan status'), queryCacheKey('pm awas status'));
    });

    test('caps key length so a pathological prompt cannot bloat the key set', () => {
        assert.equal(queryCacheKey('x'.repeat(5000)).length, 512);
    });
});

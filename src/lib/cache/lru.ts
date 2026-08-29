/**
 * Bounded in-process LRU cache with per-entry TTL.
 *
 * Backs RAG context reuse for repeated scheme queries ("how do I apply for
 * PM-Kisan?" arrives constantly). Scoped deliberately to one process:
 *
 *  - It is a latency and cost optimisation, not a source of truth, so a cold
 *    start losing the cache is harmless.
 *  - It removes the network hop that a Redis lookup would add, which is most of
 *    the win when the alternative is a ~150ms local vector search.
 *
 * Swap in Redis when hit rate matters across instances; the interface is small
 * enough to reimplement behind the same two methods.
 */

interface Entry<V> {
    value: V;
    /** Absolute epoch-ms deadline after which the entry is treated as absent. */
    expiresAt: number;
}

export interface LRUStats {
    hits: number;
    misses: number;
    evictions: number;
    expirations: number;
    size: number;
}

export class LRUCache<V> {
    private readonly store = new Map<string, Entry<V>>();
    private readonly maxEntries: number;
    private readonly ttlMs: number;

    private hits = 0;
    private misses = 0;
    private evictions = 0;
    private expirations = 0;

    constructor(maxEntries = 500, ttlMs = 15 * 60 * 1000) {
        this.maxEntries = Math.max(1, maxEntries);
        this.ttlMs = ttlMs;
    }

    get(key: string): V | undefined {
        const entry = this.store.get(key);

        if (!entry) {
            this.misses++;
            return undefined;
        }

        if (Date.now() >= entry.expiresAt) {
            this.store.delete(key);
            this.expirations++;
            this.misses++;
            return undefined;
        }

        // Re-insert to move the key to the most-recently-used end. A JS Map
        // iterates in insertion order, so delete+set is what makes eviction LRU
        // rather than FIFO.
        this.store.delete(key);
        this.store.set(key, entry);

        this.hits++;
        return entry.value;
    }

    set(key: string, value: V): void {
        // Delete first so an overwrite also refreshes recency.
        this.store.delete(key);
        this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });

        while (this.store.size > this.maxEntries) {
            const oldest = this.store.keys().next();
            if (oldest.done) break;
            this.store.delete(oldest.value);
            this.evictions++;
        }
    }

    clear(): void {
        this.store.clear();
    }

    stats(): LRUStats {
        return {
            hits: this.hits,
            misses: this.misses,
            evictions: this.evictions,
            expirations: this.expirations,
            size: this.store.size,
        };
    }
}

/**
 * Normalises a natural-language query into a cache key.
 *
 * Case, surrounding punctuation and irregular whitespace are noise here --
 * "PM Kisan status?" and "pm kisan status" should share a cache entry. The key
 * is length-capped so a pathological prompt cannot bloat the key set.
 */
export function queryCacheKey(query: string): string {
    return query
        .toLowerCase()
        .replace(/\s+/g, ' ')
        // Trim before stripping punctuation: the anchored $ will not match a
        // trailing '?' if whitespace still follows it.
        .trim()
        .replace(/[?!.,;:]+$/g, '')
        .trim()
        .slice(0, 512);
}

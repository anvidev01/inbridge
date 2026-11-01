import { tavily } from "@tavily/core";
import path from "path";
import type { Focus } from "./chat/protocol";
import type { RetrievedDoc } from "./ai/citations";
import { GOV_DOMAINS, isGovUrl } from "./ai/gov-url";
import { LRUCache, queryCacheKey } from "./cache/lru";
import { log } from "./observability/logger";
import type { RAGSource, TelemetryBatch } from "./observability/telemetry";
import type { LocalVectorStore, StoredDoc } from "./vector-search";

// Re-exported: existing callers and tests import isGovUrl from here.
export { isGovUrl };

/**
 * Label for answers grounded in the bundled dataset. The vector store was
 * built from the myScheme catalogue committed in Aug 2026 (see CLAUDE.md).
 */
export const DATASET_LABEL = "myScheme snapshot (Aug 2026)";

/**
 * Converts a FAISS IndexFlatL2 score into a cosine similarity in [-1, 1].
 *
 * The embedding model (Xenova/all-MiniLM-L6-v2) returns unit vectors -- verified
 * at an L2 norm of exactly 1.0 by scripts/probe-vector-store.mjs -- and FAISS's
 * L2 index returns the *squared* distance. For unit vectors:
 *
 *     d^2 = |a-b|^2 = 2 - 2*cos   =>   cos = 1 - d^2/2
 *
 * The previous code used `1 - score`, which is not a similarity at all: squared
 * distance runs to 4, so unrelated documents produced values like -1.29, outside
 * cosine's range entirely. Combined with a 0.7 threshold it put every real match
 * (which scores ~0.67 correctly, but 0.345 under the old formula) below the cut,
 * so the vector store silently returned nothing for every query.
 */
export function cosineFromFaissScore(score: number): number {
    return 1 - score / 2;
}

interface TavilyResult {
    title: string;
    url: string;
    content: string;
}

/**
 * Queries asking for current information ("latest", "new", a year, ...).
 * These go to live web search first: the vector store is a static snapshot
 * and would otherwise answer them with whatever it held at scrape time.
 */
const RECENCY_PATTERN = /\b(latest|newest|new|recent|recently|current|currently|today|this (week|month|year)|update[ds]?|announce[ds]?|announcement|launch(ed)?|deadline|last date|20[2-9]\d)\b|नया|नई|नए|नवीनतम|ताज़ा|ताजा/i;

export function isRecencyQuery(query: string): boolean {
    return RECENCY_PATTERN.test(query);
}

/**
 * The scheme's category line from a docstore entry.
 *
 * Category is not in the docstore metadata; the dataset builder wrote it into
 * pageContent as "CATEGORY: Education & Learning, Women and Child". Category
 * names themselves contain commas ("Agriculture,Rural & Environment"), so the
 * line is matched by substring rather than split.
 */
export function categoryLine(pageContent: string): string | null {
    const match = /^CATEGORY:\s*(.+)$/m.exec(pageContent);
    return match ? match[1].trim() : null;
}

/** True when a docstore entry belongs to the focus category ('all' matches everything). */
export function matchesFocus(pageContent: string, focus: Focus): boolean {
    if (focus === "all") return true;
    const line = categoryLine(pageContent);
    return line !== null && line.includes(focus);
}

/** What retrieveContext returns, and what the cache stores. */
export interface RetrievedContext {
    docs: RetrievedDoc[];
    source: RAGSource;
    /** When this context was fetched. A cache hit keeps the original time. */
    retrievedAt: string;
}

export type RetrievalPhase = "searching-dataset" | "searching-gov";

export interface RetrieveOptions {
    telemetry?: TelemetryBatch;
    /** Restrict vector-store results to one myScheme category. */
    focus?: Focus;
    /**
     * Text checked by isRecencyQuery. Defaults to the query; the route passes
     * only the latest message so a year mentioned three turns ago does not
     * keep sending every follow-up to live search.
     */
    recencyText?: string;
    /** Called just before each search actually starts. Not called on a cache hit. */
    onPhase?: (phase: RetrievalPhase) => void;
}

/**
 * Retrieval cache, shared across RAGEngine instances in the same process.
 *
 * Module scope rather than instance scope: the chat route constructs a
 * RAGEngine at module load, but a per-instance cache would still be lost if
 * anything ever constructs the engine per request. Keeping it here makes the
 * lifetime explicit and lets the process warm the cache across requests.
 */
const retrievalCache = new LRUCache<RetrievedContext>(
    parseInt(process.env.RAG_CACHE_MAX_ENTRIES || "500", 10),
    parseInt(process.env.RAG_CACHE_TTL_MS || String(15 * 60 * 1000), 10)
);

/** Exposed so tests and the /readyz probe can inspect cache effectiveness. */
export function ragCacheStats() {
    return retrievalCache.stats();
}

/** Exposed for tests. */
export function clearRagCache() {
    retrievalCache.clear();
}

/** After a failed vector-store load, wait this long before trying again. */
const VECTOR_STORE_RETRY_MS = 60 * 1000;

/** Documents passed to the model from the vector store. */
const VECTOR_TOP_K = 3;

/** Characters of each live-search result passed to the model. */
const MAX_LIVE_CONTENT_CHARS = 1500;

/**
 * Retrieval only: vector store, then live search of government portals. The
 * LLM call lives in src/lib/ai/router.ts. (The old query() method and its
 * Ollama/LangChain-Groq client were unused and have been removed.)
 */
export class RAGEngine {
    private vectorStorePath: string;
    private tavilyClient: ReturnType<typeof tavily> | null = null;
    private vectorStore: LocalVectorStore | null = null;
    private vectorStoreLoading: Promise<LocalVectorStore | null> | null = null;
    private lastLoadFailureAt = 0;

    // Minimum cosine similarity for a retrieved document to be used as context.
    //
    // Calibrated against the live corpus (4,740 scheme docs from the myScheme
    // catalogue). Measured cosine (via cosineFromFaissScore) at this scale:
    //   - precise queries naming a scheme:      0.60 - 0.67
    //   - vague real queries ("health insurance for poor families"): 0.40 - 0.54
    //   - unrelated / adversarial queries:       <= 0.24
    // Real-query scores compress downward versus the tiny 3-doc corpus (more
    // competing neighbours, terse official descriptions), so 0.35 fits the new
    // distribution: it recovers vague real queries while staying a clear 0.11
    // above the adversarial ceiling. Override with RAG_SIMILARITY_THRESHOLD.
    private SIMILARITY_THRESHOLD = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || "0.35");

    constructor() {
        this.vectorStorePath = path.join(process.cwd(), "vector_store");

        const apiKey = process.env.TAVILY_API_KEY;
        if (apiKey) {
            this.tavilyClient = tavily({ apiKey });
        } else {
            log.warn("TAVILY_API_KEY is not set; live government search is disabled");
        }
    }

    /** False while a failed load is backing off, so callers can skip the phase. */
    private vectorStoreAvailable(): boolean {
        return this.vectorStore !== null || Date.now() - this.lastLoadFailureAt >= VECTOR_STORE_RETRY_MS;
    }

    /**
     * Lazily loads the vector store. A failure is retried after
     * VECTOR_STORE_RETRY_MS rather than latched for the life of the instance
     * (which used to leave a warm instance on live search only until recycled).
     * Concurrent callers share one load.
     */
    private async getVectorStore(): Promise<LocalVectorStore | null> {
        if (this.vectorStore) return this.vectorStore;
        if (!this.vectorStoreAvailable()) return null;
        if (this.vectorStoreLoading) return this.vectorStoreLoading;

        this.vectorStoreLoading = (async () => {
            const started = Date.now();
            try {
                // Pure-JS search over the same FAISS index file. faiss-node's
                // native binary is not bundled by Vercel, so FaissStore.load
                // always failed there. Dynamic import keeps the embedding runtime
                // off the cold path until the first query needs it.
                const { LocalVectorStore } = await import("./vector-search");
                this.vectorStore = await LocalVectorStore.load(this.vectorStorePath);
                log.info("Vector store loaded", { duration_ms: Date.now() - started });
                return this.vectorStore;
            } catch (error) {
                this.lastLoadFailureAt = Date.now();
                log.error("Failed to load vector store; retrying after backoff", {
                    error,
                    retry_ms: VECTOR_STORE_RETRY_MS,
                });
                return null;
            } finally {
                this.vectorStoreLoading = null;
            }
        })();
        return this.vectorStoreLoading;
    }

    /**
     * Returns retrieval context for a query, serving repeats from the LRU cache.
     *
     * Emits exactly one rag_cache event per call so that
     * inbridge_rag_cache_hits_total / (hits + misses) is a true hit rate.
     */
    public async retrieveContext(query: string, options: RetrieveOptions = {}): Promise<RetrievedContext> {
        const { telemetry, focus = "all" } = options;
        const started = Date.now();
        const key = `${focus}|${queryCacheKey(query)}`;

        const cached = retrievalCache.get(key);
        if (cached) {
            const elapsed = Date.now() - started;
            telemetry?.ragCache("hit", "cache", elapsed);
            log.info("RAG cache hit", {
                duration_ms: elapsed,
                cached_source: cached.source,
                citations: cached.docs.length,
            });
            return cached;
        }

        const result = await this.retrieveUncached(query, { ...options, focus });
        const elapsed = Date.now() - started;

        telemetry?.ragCache("miss", result.source, elapsed);
        log.info("RAG retrieval completed", {
            duration_ms: elapsed,
            source: result.source,
            citations: result.docs.length,
            focus,
        });

        // Only cache a real retrieval. An empty result means the vector store
        // missed *and* Tavily failed or was unconfigured; caching that would pin
        // a transient outage in front of every repeat of the query for the whole
        // TTL, long after the dependency recovered.
        if (result.docs.length > 0) {
            retrievalCache.set(key, result);
        }

        return result;
    }

    /**
     * Live search of official government sites via Tavily.
     *
     * Every result is re-checked with isGovUrl, so only .gov.in / .nic.in pages
     * ever reach the LLM regardless of how Tavily interprets include_domains.
     * If the domain-restricted search comes back empty, retry unrestricted and
     * keep only the government hits.
     */
    private async searchGovPortals(query: string, onPhase?: RetrieveOptions["onPhase"]): Promise<RetrievedDoc[] | null> {
        if (!this.tavilyClient) return null;
        onPhase?.("searching-gov");

        const attempts = [
            { includeDomains: GOV_DOMAINS, maxResults: 5 },
            { query: `${query} site:gov.in OR site:nic.in`, maxResults: 10 },
        ];

        for (const { query: attemptQuery, ...options } of attempts) {
            try {
                const searchResult = await this.tavilyClient.search(attemptQuery ?? query, {
                    searchDepth: "advanced",
                    ...options,
                });
                const results = ((searchResult.results ?? []) as TavilyResult[])
                    .filter((r) => isGovUrl(r.url) && r.content)
                    .slice(0, 5);

                log.info("Tavily search completed", {
                    restricted: "includeDomains" in options,
                    raw_results: searchResult.results?.length ?? 0,
                    gov_results: results.length,
                });

                if (results.length > 0) {
                    return results.map((r) => ({
                        title: r.title,
                        url: r.url,
                        content: r.content.slice(0, MAX_LIVE_CONTENT_CHARS),
                    }));
                }
            } catch (error) {
                log.warn("Tavily search error", { error });
            }
        }
        return null;
    }

    /** Top matches from the bundled dataset above the similarity threshold. */
    private async searchDataset(query: string, focus: Focus, onPhase?: RetrieveOptions["onPhase"]): Promise<RetrievedDoc[]> {
        if (!this.vectorStoreAvailable()) return [];
        onPhase?.("searching-dataset");

        const store = await this.getVectorStore();
        if (!store) return [];

        try {
            const filter = focus === "all" ? undefined : (doc: StoredDoc) => matchesFocus(doc.pageContent, focus);
            const results = await store.similaritySearchWithScore(query, VECTOR_TOP_K, filter);
            const kept = results.filter(([, score]) => cosineFromFaissScore(score) >= this.SIMILARITY_THRESHOLD);

            if (kept.length === 0 && results.length > 0) {
                log.debug("Vector store hit below similarity threshold", {
                    similarity: Number(cosineFromFaissScore(results[0][1]).toFixed(3)),
                    threshold: this.SIMILARITY_THRESHOLD,
                });
            }

            return kept.map(([doc]) => ({
                title: String(doc.metadata.title ?? ""),
                url: String(doc.metadata.url ?? ""),
                content: doc.pageContent,
            }));
        } catch (error) {
            log.warn("Vector search error", { error });
            return [];
        }
    }

    /**
     * Performs the actual retrieval: vector store first, Tavily as fallback.
     * Recency queries ("latest ...") go to Tavily first instead.
     */
    private async retrieveUncached(query: string, options: RetrieveOptions & { focus: Focus }): Promise<RetrievedContext> {
        const { focus, onPhase } = options;
        const recency = isRecencyQuery(options.recencyText ?? query);
        const now = () => new Date().toISOString();

        if (recency) {
            const live = await this.searchGovPortals(query, onPhase);
            if (live) return { docs: live, source: "tavily_search", retrievedAt: now() };
        }

        const dataset = await this.searchDataset(query, focus, onPhase);
        if (dataset.length > 0) {
            return { docs: dataset, source: "vector_store", retrievedAt: now() };
        }

        // Recency queries already tried live search above.
        if (!recency) {
            const live = await this.searchGovPortals(query, onPhase);
            if (live) return { docs: live, source: "tavily_search", retrievedAt: now() };
        }

        return { docs: [], source: "llm_direct", retrievedAt: now() };
    }
}

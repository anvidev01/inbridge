
import { ChatOllama } from "@langchain/ollama";
import { ChatGroq } from "@langchain/groq";
import { tavily } from "@tavily/core";
import path from "path";
import { LRUCache, queryCacheKey } from "./cache/lru";
import { log } from "./observability/logger";
import type { RAGSource, TelemetryBatch } from "./observability/telemetry";

// Define interfaces for our RAG response
export interface RAGResponse {
    answer: string;
    // Widened to RAGSource: a cached retrieval reports source "cache".
    source: RAGSource;
    citations: Array<{
        title: string;
        url?: string;
        content: string;
    }>;
}

export type Language = 'en' | 'hi' | 'bn' | 'mr' | 'te' | 'hinglish';

const PROMPTS: Record<Language, string> = {
    en: "You are an official government assistant. Respond strictly in English. Maintain a formal, helpful tone.",
    hi: "आप एक आधिकारिक सरकारी सहायक हैं। कृपया उत्तर केवल हिंदी (देवनागरी लिपि) में दें। औपचारिक और सहायक लहज़ा बनाए रखें।",
    bn: "আপনি একজন সরকারি সহায়ক। দয়া করে উত্তর শুধুমাত্র বাংলায় দিন। আনুষ্ঠানিক এবং সহায়ক সুর বজায় রাখুন।",
    mr: "तुम्ही एक अधिकृत सरकारी सहाय्यक आहात. कृपया उत्तर फक्त मराठीत द्या. औपचारिक आणि मदतीचा सूर ठेवा.",
    te: "మీరు ప్రభుత్వ సహాయకులు. దయచేసి సమాధానం తెలుగులో మాత్రమే ఇవ్వండి. అధికారిక మరియు సహాయక ధోరణిని కొనసాగించండి.",
    hinglish: "You are an official government assistant. Respond in Hinglish. Use Devanagari script for conversational Hindi text, but keep technical terms (like 'Aadhaar', 'Scheme', 'Apply') strictly in English (Latin script). Example: 'Aadhaar Card ke liye apply karein'."
};

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

/** True when a URL is hosted on an official Indian government domain. */
export function isGovUrl(url: string | undefined): boolean {
    if (!url) return false;
    try {
        const host = new URL(url).hostname.toLowerCase();
        return GOV_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
    } catch {
        return false;
    }
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

// Bare domain suffixes: Tavily's include_domains takes domains, not ".gov.in".
// The previous [".gov.in", ".nic.in"] made every Tavily search return zero
// results in production (logs: Tavily called, citations: 0, no error).
const GOV_DOMAINS = ["gov.in", "nic.in"];

/** What retrieveContext returns, and what the cache stores. */
export interface RetrievedContext {
    context: string;
    source: RAGSource;
    citations: any[];
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

export class RAGEngine {
    private vectorStorePath: string;
    private llm: ChatOllama | ChatGroq;
    private tavilyClient: any; // Using any for now as @tavily/core types might vary
    private isInitialized: boolean = false;
    private vectorStore: import("./vector-search").LocalVectorStore | null = null;

    // Configuration
    //
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
    private LLM_MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b"; // llama-3.3-70b-versatile was retired from Groq
    private OLLAMA_MODEL = "llama3.2:3b";

    constructor() {
        this.vectorStorePath = path.join(process.cwd(), "vector_store");

        // Initialize LLM (Groq Preferred for Vercel, Ollama fallback)
        const groqApiKey = process.env.GROQ_API_KEY;
        if (groqApiKey) {
            console.log("Using Groq Cloud LLM");
            this.llm = new ChatGroq({
                apiKey: groqApiKey,
                model: this.LLM_MODEL,
                temperature: 0.1
            });
        } else {
            console.log("Using Local Ollama (Fallback)");
            this.llm = new ChatOllama({
                baseUrl: "http://localhost:11434", // Default Ollama URL
                model: this.OLLAMA_MODEL,
                temperature: 0.1, // Lower temperature for more deterministic translations
            });
        }

        // Initialize Tavily
        const apiKey = process.env.TAVILY_API_KEY;
        if (apiKey) {
            this.tavilyClient = tavily({ apiKey });
        } else {
            console.warn("TAVILY_API_KEY is not set. Fallback search will not work.");
        }
    }

    // Lazy initialization of the vector store
    private async initializeVectorStore() {
        if (this.isInitialized) return;

        try {
            console.log(`Loading vector store from: ${this.vectorStorePath}`);
            const started = Date.now();

            // Pure-JS search over the same FAISS index file. faiss-node's native
            // binary is not bundled by Vercel, so FaissStore.load always failed
            // there. Dynamic import keeps the embedding runtime off the cold path
            // until the first query needs it.
            const { LocalVectorStore } = await import("./vector-search");
            this.vectorStore = await LocalVectorStore.load(this.vectorStorePath);
            log.info("Vector store loaded", { duration_ms: Date.now() - started });
            this.isInitialized = true;
        } catch (error) {
            console.error("⚠️ Failed to load vector store (Running in Fallback Mode):", error);
            // We might proceed without vector store if it fails, relying on Tavily/LLM
            this.vectorStore = null;
            this.isInitialized = true; // Mark as initialized so we don't retry forever
        }
    }

    /**
     * Returns retrieval context for a query, serving repeats from the LRU cache.
     *
     * Emits exactly one rag_cache event per call so that
     * inbridge_rag_cache_hits_total / (hits + misses) is a true hit rate.
     */
    public async retrieveContext(
        userMessage: string,
        telemetry?: TelemetryBatch
    ): Promise<RetrievedContext> {
        const started = Date.now();
        const key = queryCacheKey(userMessage);

        const cached = retrievalCache.get(key);
        if (cached) {
            const elapsed = Date.now() - started;
            telemetry?.ragCache("hit", "cache", elapsed);
            log.info("RAG cache hit", {
                duration_ms: elapsed,
                cached_source: cached.source,
                citations: cached.citations.length,
            });
            return cached;
        }

        const result = await this.retrieveUncached(userMessage);
        const elapsed = Date.now() - started;

        telemetry?.ragCache("miss", result.source, elapsed);
        log.info("RAG retrieval completed", {
            duration_ms: elapsed,
            source: result.source,
            citations: result.citations.length,
            context_chars: result.context.length,
        });

        // Only cache a real retrieval. An empty context means the vector store
        // missed *and* Tavily failed or was unconfigured; caching that would pin
        // a transient outage in front of every repeat of the query for the whole
        // TTL, long after the dependency recovered.
        if (result.context) {
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
    private async searchGovPortals(userMessage: string): Promise<{ context: string; citations: RAGResponse["citations"] } | null> {
        if (!this.tavilyClient) return null;

        const attempts = [
            { includeDomains: GOV_DOMAINS, maxResults: 5 },
            { query: `${userMessage} site:gov.in OR site:nic.in`, maxResults: 10 },
        ];

        for (const { query, ...options } of attempts) {
            try {
                const searchResult = await this.tavilyClient.search(query ?? userMessage, {
                    searchDepth: "advanced",
                    ...options,
                });
                const results = ((searchResult.results ?? []) as TavilyResult[])
                    .filter((r) => isGovUrl(r.url) && r.content)
                    .slice(0, 5);

                log.info("Tavily search completed", {
                    restricted: Boolean(options.includeDomains),
                    raw_results: searchResult.results?.length ?? 0,
                    gov_results: results.length,
                });

                if (results.length > 0) {
                    return {
                        context: results
                            .map((r) => `Source: ${r.title} (${r.url})\n${r.content}`)
                            .join("\n\n"),
                        citations: results.map((r) => ({
                            title: r.title,
                            url: r.url,
                            content: r.content.substring(0, 100) + "...",
                        })),
                    };
                }
            } catch (err) {
                console.error("Tavily search error:", err);
            }
        }
        return null;
    }

    /**
     * Performs the actual retrieval: vector store first, Tavily as fallback.
     * Recency queries ("latest ...") go to Tavily first instead.
     */
    private async retrieveUncached(userMessage: string): Promise<RetrievedContext> {
        if (isRecencyQuery(userMessage)) {
            const live = await this.searchGovPortals(userMessage);
            if (live) return { ...live, source: "tavily_search" };
        }

        // Attempt to load VS, but don't block
        await this.initializeVectorStore();

        let context = "";
        let source: RAGSource = "vector_store";
        let citations: any[] = [];

        // 1. Try Vector Search first
        if (this.vectorStore) {
            try {
                // Search for relevant documents with score
                const results = await this.vectorStore.similaritySearchWithScore(userMessage, 3);

                if (results.length > 0) {
                    const topScore = results[0][1];
                    const similarity = cosineFromFaissScore(topScore);
                    if (similarity >= this.SIMILARITY_THRESHOLD) {
                        const filteredResults = results.filter(
                            ([_, score]: [any, number]) => cosineFromFaissScore(score) >= this.SIMILARITY_THRESHOLD
                        );
                        context = filteredResults.map(([doc, _]: [any, any]) => doc.pageContent).join("\n\n");
                        citations = filteredResults.map(([doc, _]: [any, any]) => doc.metadata);
                        source = "vector_store";
                    } else {
                        log.debug("Vector store hit below similarity threshold", {
                            similarity: Number(similarity.toFixed(3)),
                            threshold: this.SIMILARITY_THRESHOLD,
                        });
                    }
                }
            } catch (err) {
                console.error("Vector search error:", err);
            }
        }

        // 2. Fallback to Tavily if context is empty
        if (!context && this.tavilyClient && !isRecencyQuery(userMessage)) {
            console.log("⚠️ Low confidence or no local results. Falling back to Tavily...");
            const live = await this.searchGovPortals(userMessage);
            if (live) {
                context = live.context;
                citations = live.citations;
                source = "tavily_search";
            }
        }

        if (!context) {
            source = "llm_direct";
        }

        return { context, source, citations };
    }

    public async query(userMessage: string, language: Language = 'en'): Promise<RAGResponse> {
        const { context, source, citations } = await this.retrieveContext(userMessage);

        // 3. Generate Response using Ollama with Language Dynamic Prompt
        const languageInstruction = PROMPTS[language] || PROMPTS['en'];

        const systemPrompt = `You are InBridge, a vital government service assistant for India.
${languageInstruction}

STRICT INSTRUCTIONS:
1. Use the provided Context ONLY. If the Answer is not in the context, politely say you don't know in the target language.
2. The Context is provided in English/Hindi. You MUST TRANSLATE and SYNTHESIZE the answer into the target language defined above.
3. Be polite, formal, and accurate.
4. Keep the answer concise.

CONTEXT:
${context}

USER QUESTION:
${userMessage}
`;

        try {
            const response = await (this.llm as any).invoke([
                ["system", systemPrompt],
                ["human", userMessage]
            ]);

            return {
                answer: response.content.toString(),
                source: source,
                citations: citations
            };
        } catch (err) {
            console.error("LLM generation error:", err);
            // IMPORTANT: Don't crash, return a user-friendly error
            return {
                answer: `Error: Unable to generate response. (${err instanceof Error ? err.message : 'Unknown Error'})`,
                source: "llm_direct",
                citations: []
            };
        }
    }
}


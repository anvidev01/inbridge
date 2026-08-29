
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
    private embeddings: any; // Dynamic type
    private llm: ChatOllama | ChatGroq;
    private tavilyClient: any; // Using any for now as @tavily/core types might vary
    private isInitialized: boolean = false;
    private vectorStore: any = null; // Type as any since we load dynamically

    // Configuration
    private SIMILARITY_THRESHOLD = 0.7; // As per requirements
    private LLM_MODEL = "llama-3.3-70b-versatile"; // Latest Groq Model (Replacing decommissioned llama3-8b)
    private OLLAMA_MODEL = "llama3.2:3b";
    private TAVILY_DOMAINS = [".gov.in", ".nic.in"];

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
            
            // Dynamic import to prevent startup crash on Vercel
            const { HuggingFaceTransformersEmbeddings } = await import("@langchain/community/embeddings/huggingface_transformers");
            this.embeddings = new HuggingFaceTransformersEmbeddings({
                model: "Xenova/all-MiniLM-L6-v2",
            });

            // Dynamic import to prevent startup crash if binary is missing/incompatible
            const { FaissStore } = await import("@langchain/community/vectorstores/faiss");

            this.vectorStore = await FaissStore.load(
                this.vectorStorePath,
                this.embeddings
            );
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

    /** Performs the actual retrieval: vector store first, Tavily as fallback. */
    private async retrieveUncached(userMessage: string): Promise<RetrievedContext> {
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
                    const similarity = 1 - topScore; // standard distance-to-similarity mapping
                    if (similarity >= this.SIMILARITY_THRESHOLD) {
                        const filteredResults = results.filter(([_, score]: [any, number]) => (1 - score) >= this.SIMILARITY_THRESHOLD);
                        context = filteredResults.map(([doc, _]: [any, any]) => doc.pageContent).join("\n\n");
                        citations = filteredResults.map(([doc, _]: [any, any]) => doc.metadata);
                        source = "vector_store";
                    } else {
                        console.log(`⚠️ Top result similarity (${similarity.toFixed(3)}) is below threshold (${this.SIMILARITY_THRESHOLD}). Treating as a miss.`);
                    }
                }
            } catch (err) {
                console.error("Vector search error:", err);
            }
        }

        // 2. Fallback to Tavily if context is empty
        if (!context && this.tavilyClient) {
            try {
                console.log("⚠️ Low confidence or no local results. Falling back to Tavily...");
                const searchResult = await this.tavilyClient.search(userMessage, {
                    search_depth: "advanced",
                    include_domains: this.TAVILY_DOMAINS,
                    max_results: 3
                });

                if (searchResult.results && searchResult.results.length > 0) {
                    context = searchResult.results.map((r: any) => r.content).join("\n\n");
                    citations = searchResult.results.map((r: any) => ({
                        title: r.title,
                        url: r.url,
                        content: r.content.substring(0, 100) + "..."
                    }));
                    source = "tavily_search";
                }
            } catch (err) {
                console.error("Tavily search error:", err);
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


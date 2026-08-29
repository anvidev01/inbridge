# Load Test Results — `/api/chat`

All numbers below were measured on this repo, not estimated. Re-running the
commands in [README.md](README.md) reproduces them.

## Environment

| | |
|---|---|
| Host | Apple Silicon (darwin/arm64), Node v24.18.0 |
| Server | `next start` (production build), single process |
| Tool | k6 v2.2.0 |
| Load | 20 VUs, constant, 45s |
| Traffic mix | 70% repeated ("hot") queries, 30% unique ("cold") — `CACHE_HIT_RATIO=0.7` |
| Vector store | local FAISS index, 3 documents |
| LLM providers | **not configured** — see *What these numbers measure* |

### What these numbers measure

No LLM API keys were available in this environment, so every request runs the
full path up to the provider call and then returns 500:

```
rate limit → body parse → guardrails/PII → RAG retrieval → provider chain (empty) → 500
```

That is deliberate for this comparison. The optimisations under test are in
retrieval, and excluding the provider call removes several seconds of
network-bound variance that would otherwise swamp them. **These are not
end-to-end chat latencies** — a real answer adds the provider's streaming time
on top. Re-run with keys set and `ACCEPT_5XX` unset for end-to-end SLO numbers.

---

## Finding 1 — the vector store was returning nothing for every query

Before anything was tuned, RAG retrieval was resolving to `llm_direct` with
`context_chars: 0` on **100% of queries**. The cause was in the
distance→similarity conversion, not in the index or the corpus:

```ts
const similarity = 1 - topScore;   // topScore is FAISS's *squared* L2 distance
```

`scripts/probe-vector-store.mjs` establishes the actual semantics:

- The embedding model (`Xenova/all-MiniLM-L6-v2`) returns **unit vectors** —
  measured L2 norm exactly `1.000000`.
- FAISS `IndexFlatL2` therefore returns **squared** L2 distance, observed in the
  range `0.65 – 2.29`.
- For unit vectors `d² = 2 − 2·cos`, so `cos = 1 − d²/2`.

The old formula is not a mis-tuned similarity, it is not a similarity at all: an
unrelated query scored `1 − 2.29 = −1.29`, outside cosine's `[−1, 1]` range
entirely. Measured against the real corpus:

| Query | FAISS score | `1 − score` (old) | `1 − score/2` (correct) |
|---|---|---|---|
| "How do I apply for PM-Kisan?" → PM-Kisan doc | 0.6550 | 0.345 | **0.672** |
| "Aadhaar update documents?" → Aadhaar doc | 0.7009 | 0.299 | **0.650** |
| "PAN card status?" → best doc (no PAN doc exists) | 1.5089 | −0.509 | 0.246 |
| "quantum mechanics" → best doc | 2.0345 | −1.034 | −0.017 |

With the threshold at 0.7, every genuine match (0.345, 0.299 under the old
formula) fell below the cut. Fixing the formula and moving the threshold to 0.5
— which sits in the clear gap between matches at 0.65–0.67 and non-matches at
≤0.25 — makes retrieval work:

```
before:  "source":"llm_direct",   "citations":0, "context_chars":0
after:   "source":"vector_store", "citations":1, "context_chars":721
```

This was a correctness bug before it was a performance one: the RAG pipeline was
answering from no context at all.

---

## Finding 2 — RAG response cache, before/after

Control: `RAG_CACHE_TTL_MS=0` makes every entry immediately stale, so every
lookup misses. Confirmed in the logs — the "before" run recorded **0 cache
hits across 17,830 retrievals**.

| Metric | Before (no cache) | After (cache) | Change |
|---|---|---|---|
| Hot query p95 | 90.0 ms | **66.6 ms** | **−26.0%** |
| Hot query p99 | 99.2 ms | **78.8 ms** | −20.6% |
| Hot query median | 47.5 ms | **36.3 ms** | −23.6% |
| Cold query p95 | 90.2 ms | **72.4 ms** | −19.7% |
| Cold query p99 | 100.0 ms | **82.5 ms** | −17.5% |
| All requests p95 | 90.0 ms | **68.9 ms** | −23.4% |
| All requests p99 | 99.3 ms | **80.4 ms** | −19.0% |
| Completed requests (45s, 20 VUs) | 17,827 | **23,100** | **+29.6%** |

**Cold queries got faster too, by 20%** — which is the more interesting result.
A cold query never touches the cache, so nothing about its own path changed.
Query embedding is CPU-bound and Node runs it on one thread, so every request
served from cache is embedding work that is *not* queued ahead of a cold query.
The cache reduces contention for the whole process, not just for its own hits.

### Measured hit rate: 28.1%

The run sent 70% hot queries but recorded 6,497 hits against 16,606 misses.
That gap is not a cache defect — only 2 of the 5 hot queries produce cacheable
context, because the demo corpus holds 3 documents:

| Hot query | Retrieval result | Cached? |
|---|---|---|
| How do I apply for PM-Kisan? | `vector_store`, 721 chars | yes |
| What documents do I need for an Aadhaar update? | `vector_store`, 602 chars | yes |
| How do I check my PAN card application status? | `llm_direct`, 0 chars | no |
| What is the eligibility for PM Awas Yojana? | `llm_direct`, 0 chars | no |
| How do I file a grievance about a delayed pension? | `llm_direct`, 0 chars | no |

`0.7 × (2/5) = 28%`, matching the observed 28.1%. Empty-context results are
deliberately not cached: caching them would pin a transient retrieval failure
in front of every repeat of that query for the full TTL.

So the 26% p95 improvement was achieved at a **28% hit rate**. A production
corpus covering the common queries would raise the hit rate and with it the
gain.

---

## Not measured here

- **End-to-end chat latency including the LLM call.** Needs provider API keys.
- **The Go backend endpoints** (`loadtest/k6/api_load.js`). Needs Postgres and
  Redis; the Docker daemon was not running in this environment.
- **DB index effectiveness** (`007_performance_indexes.sql`). Same reason. The
  indexes are committed but their before/after has not been measured, and this
  file does not claim otherwise.

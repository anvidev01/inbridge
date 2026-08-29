# InBridge Load Testing

Two scripts:

| Script | Target | Needs |
|---|---|---|
| `k6/chat_load.js` | `POST /api/chat` (Next.js) — rate limit → guardrails → RAG → LLM chain | Next.js server |
| `k6/api_load.js` | Go backend CRUD (`/api/v1/*`) | Go backend + Postgres + Redis |

Measured numbers live in **[RESULTS.md](RESULTS.md)**.

## Prerequisites

Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/

```bash
# macOS (Homebrew)
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

## Quick Start

```bash
# 1. Make sure the backend is running on localhost:8080
# 2. Create results directory
mkdir -p loadtest/results

# 3. Run with defaults (targets localhost:8080)
k6 run loadtest/k6/chat_load.js

# 4. Run against a specific environment, save JSON output
BASE_URL=http://localhost:8080 \
TEST_EMAIL=load@test.local \
TEST_PASS=LoadTest1! \
k6 run loadtest/k6/chat_load.js \
  --out json=loadtest/results/baseline_$(date +%Y%m%d_%H%M%S).json
```

## Load Profile

| Stage    | Duration | VUs  | Purpose                        |
|----------|----------|------|--------------------------------|
| Ramp-up  | 30s      | 0→10 | Warm up connection pools       |
| Sustained| 60s      | 50   | Baseline measurement           |
| Spike    | 30s      | 100  | Stress test / pool exhaustion  |
| Ramp-down| 30s      | 100→0| Graceful cool-down             |

## SLO Thresholds

| Metric              | Threshold  |
|---------------------|------------|
| p95 response time   | < 2 000ms  |
| p99 response time   | < 4 000ms  |
| HTTP error rate     | < 1%       |
| Auth p95 latency    | < 1 500ms  |

## Interpreting Results

```
data_received:         total bytes received from server
data_sent:             total bytes sent to server
http_req_duration:     end-to-end request duration (connect + send + wait + receive)
http_req_failed:       rate of failed requests (non-2xx)
auth_login_duration:   custom metric — login endpoint only
service_apply_duration: custom metric — service apply endpoint only
```

## Reproducing the RAG cache before/after

`RAG_CACHE_TTL_MS=0` expires every entry immediately, which is the control:
the same code path, with no reuse.

```bash
# 1. baseline — cache disabled
CHAT_RATE_LIMIT_PER_MIN=1000000 RAG_CACHE_TTL_MS=0 npm start &
# warm the embedding model and FAISS index first, or the first request's
# ~13s model load lands in the histogram
curl -s -o /dev/null -X POST localhost:3000/api/chat -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","parts":[{"type":"text","text":"warmup"}]}]}'

BASE_URL=http://localhost:3000 RUN_LABEL=before VUS=20 DURATION=45s ACCEPT_5XX=true \
  k6 run loadtest/k6/chat_load.js

# 2. cache enabled — restart, warm again, rerun with RUN_LABEL=after
```

`ACCEPT_5XX=true` is required when no LLM provider keys are set: the chain runs
and then correctly reports that nothing is configured. Drop it for end-to-end
runs with real keys.

Raw k6 summaries land in `loadtest/results/` (gitignored); the numbers worth
keeping go in [RESULTS.md](RESULTS.md).

## Optimisations

### Measured (see [RESULTS.md](RESULTS.md))

1. **FAISS distance→similarity conversion** (`src/lib/rag-engine.ts`)
   `1 - score` was applied to a *squared* L2 distance, so no query ever cleared
   the similarity threshold and the vector store returned empty context 100% of
   the time. Corrected to `1 - score/2` with the threshold recalibrated to 0.5
   against measured scores. Retrieval went from 0 to 721 chars of context on a
   representative query.

2. **RAG response cache** (`src/lib/cache/lru.ts`)
   Bounded LRU with TTL in front of retrieval. At a 28% measured hit rate:
   p95 −26% on repeated queries, −20% on unique ones, throughput +29.6%.

### Committed but not yet measured

3. **DB index migration** (`007_performance_indexes.sql`)
   Indexes on grievance/audit/application lookups. Measuring these needs
   Postgres under `api_load.js`; no before/after has been recorded yet.

4. **Prometheus `MetricsMiddleware` first in the chi chain**
   So requests that panic into `Recoverer` are still counted. This is a
   correctness property of the metrics, not a latency optimisation.

5. **Circuit breakers on the LLM chain** (`backend/circuit/providers.go`)
   A struggling provider is skipped rather than retried, which should cut tail
   latency during a provider outage. Verified functionally by tests; the
   latency effect has not been load-tested, as it needs a provider to fail
   under load.

## Notes

- Rate limiting on `/auth/register` and `/auth/login` is set to 5 req/min (anon).
  The load test uses a shared credential so rate-limit keys are per-IP — running k6
  from a single machine may trigger 429s on the auth stage at high VU counts.
  Lower VUs or set `rateLimit: false` in staging environments.

- The `/api/v1/services/apply` endpoint writes to the DB on every call.
  Clean up after load tests: `DELETE FROM applications WHERE arn LIKE 'ARN-pmkisan-%';`

# InBridge Go Backend 🚀

The high-performance, production-hardened Go backend for the InBridge platform.

## 🛡️ Production Hardening
This backend has undergone a comprehensive security and performance audit:
- **Authentication**: JWT (RS256) using RSA 4096-bit key pair. No development bypasses.
- **Rate Limiting**: Redis-backed sliding window rate limiting on all authentication routes.
- **Audit Logging**: Mandatory audit trail for all write operations (Grievances, Applications).
- **Masking**: Automatic PII masking (Aadhaar/VID) in all API responses.
- **Graceful Shutdown**: Handles OS signals (`SIGTERM`, `SIGINT`) to close DB connections and finish active requests.

## 🏗️ Architecture
- **Router**: [chi v5](https://github.com/go-chi/chi) for lightweight, idiomatic routing.
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [pgx v5](https://github.com/jackc/pgx) connection pooling.
- **Cache/RL**: [Redis](https://redis.io/) via [go-redis v8](https://github.com/go-redis/redis).
- **Logging**: [zerolog](https://github.com/rs/zerolog) for structured JSON logging.

## 🚀 Getting Started

### 1. Environment Configuration
Copy `.env.example` to `.env` and fill in the required values.
```bash
cp .env.example .env
```

### 2. Generate RSA Keys (for JWT)
```bash
ssh-keygen -t rsa -b 4096 -m PEM -f jwt.key
openssl rsa -in jwt.key -pubout -outform PEM -out jwt.key.pub
```
Ensure the content of these keys (including `---BEGIN...`) is placed in your `.env` file under `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY`. Use double quotes and escape newlines if necessary depending on your environment loader.

### 3. Run Locally
```bash
go run main.go
```

## 📑 API documentation (v1)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | None | Citizen registration |
| POST | `/api/v1/auth/login` | None | Login & receive JWT |
| GET | `/api/v1/services` | None | List available government services |
| GET | `/api/v1/status/{arn}` | None | Track application by ARN |
| GET | `/api/v1/citizen/profile` | JWT | Get authenticated profile |
| POST | `/api/v1/services/apply` | JWT | Submit service application |
| POST | `/api/v1/grievance` | JWT | File a new grievance |
| GET | `/api/v1/health` | None | Legacy combined health check |

### Operational endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/healthz` | None | Liveness. 200 whenever the process is up. |
| GET | `/readyz` | None | Readiness. 503 unless Postgres, Redis **and** at least one non-open LLM provider are healthy. Body lists per-provider breaker state. |
| GET | `/metrics` | None | Prometheus exposition |
| POST | `/internal/telemetry/llm` | `X-Internal-Token` | LLM/RAG events from the Next.js chat plane |
| GET | `/internal/llm/providers` | `X-Internal-Token` | Per-provider circuit breaker state |

The `/internal/*` routes are mounted **only** when `INTERNAL_API_TOKEN` is set,
so an unconfigured deployment exposes no internal surface at all.

## 📊 Observability

Metrics are prefixed `inbridge_`. The `path` label is always a chi route
pattern (`/api/v1/grievance/{id}`), never a raw URL, and unrouted requests
collapse to `unmatched` — otherwise every grievance UUID and 404 probe would
mint its own time series.

| Metric | Type | Notes |
|---|---|---|
| `inbridge_http_request_duration_seconds` | histogram | by method, path, status |
| `inbridge_http_errors_total` | counter | 4xx/5xx |
| `inbridge_llm_requests_total` | counter | completions served, by provider |
| `inbridge_llm_failovers_total` | counter | by from/to provider |
| `inbridge_llm_request_duration_seconds` | histogram | by provider, outcome |
| `inbridge_llm_errors_total` | counter | by provider, kind |
| `inbridge_rag_cache_hits_total` / `_misses_total` | counter | hit rate denominator |
| `inbridge_rag_retrieval_duration_seconds` | histogram | by resolved source |
| `inbridge_circuit_breaker_open` | gauge | 1 = open, per breaker |
| `inbridge_telemetry_events_total` | counter | chat-plane link health |
| `inbridge_alerts_fired_total` | counter | by reason |

The LLM and RAG series are fed by the Next.js chat plane over
`/internal/telemetry/llm`, not produced in this process. If
`inbridge_telemetry_events_total` flatlines while HTTP traffic continues, those
panels are stale rather than healthy.

## 🛠️ Verification
Run the following to ensure everything is correct:
```bash
go vet ./...
go build ./...
go test -race ./...
```

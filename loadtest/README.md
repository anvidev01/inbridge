# InBridge Load Testing

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

## Before / After Comparison

Run a baseline before the DB index migration:
```bash
k6 run loadtest/k6/chat_load.js --out json=loadtest/results/before_indexes.json
```

Apply the migration (`007_performance_indexes.sql`), then:
```bash
k6 run loadtest/k6/chat_load.js --out json=loadtest/results/after_indexes.json
```

Compare p95:
```bash
jq '.metrics.http_req_duration.values["p(95)"]' \
  loadtest/results/before_indexes.json \
  loadtest/results/after_indexes.json
```

## Optimisations Applied

The following optimisations were identified and patched after profiling:

### 1. DB Index Migration (`007_performance_indexes.sql`)
- `idx_grievances_citizen_id` — prevents seq-scan on citizen grievance lookups
- `idx_grievances_citizen_status` — enables efficient status-filtered queries
- `idx_audit_log_citizen_time` — compliance time-range queries now use index-only scans
- `idx_audit_log_action` — admin audit filtering by action type
- `idx_applications_service_status` — dashboard analytics on application pipeline

### 2. Prometheus `MetricsMiddleware` placed first in chi middleware chain
- Ensures accurate request counting even for panicked requests caught by Recoverer.

### 3. Circuit Breaker (`circuit/breaker.go`)
- Prevents cascading failures when the Python AI service is slow/down.
- Under load, open CB prevents VU threads from blocking on 30s timeouts.
- Dramatically reduces p99 tail latency during AI service degradation.

### 4. Structured JSON Logging
- Replaced `ConsoleWriter` (synchronous pretty-printer) with `zerolog.New(os.Stdout)`.
- Under 100 VU spike, the previous console formatter caused measurable lock contention.

## Notes

- Rate limiting on `/auth/register` and `/auth/login` is set to 5 req/min (anon).
  The load test uses a shared credential so rate-limit keys are per-IP — running k6
  from a single machine may trigger 429s on the auth stage at high VU counts.
  Lower VUs or set `rateLimit: false` in staging environments.

- The `/api/v1/services/apply` endpoint writes to the DB on every call.
  Clean up after load tests: `DELETE FROM applications WHERE arn LIKE 'ARN-pmkisan-%';`

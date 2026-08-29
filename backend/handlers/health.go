package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"runtime"
	"time"

	"github.com/MeitY/inbridge-backend/circuit"
	"github.com/go-redis/redis/v8"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// HealthCheck is the legacy combined health endpoint kept for backward compatibility
// at /api/v1/health. It checks Postgres and Redis and returns a JSON summary.
func HealthCheck(db *pgxpool.Pool, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		dbStatus := "down"
		if err := db.Ping(ctx); err == nil {
			dbStatus = "up"
		}

		redisStatus := "down"
		if err := rdb.Ping(ctx).Err(); err == nil {
			redisStatus = "up"
		}

		overallStatus := "ok"
		statusCode := http.StatusOK
		if dbStatus == "down" || redisStatus == "down" {
			overallStatus = "degraded"
		}

		response := map[string]interface{}{
			"status": overallStatus,
			"services": map[string]string{
				"postgres": dbStatus,
				"redis":    redisStatus,
			},
			"runtime": map[string]string{
				"go_version": runtime.Version(),
				"os":         runtime.GOOS,
				"arch":       runtime.GOARCH,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)
		json.NewEncoder(w).Encode(response)
	}
}

// Liveness returns a trivial 200 OK handler at /healthz.
// A live response means the process is running and can accept connections.
// Kubernetes restarts the pod only if this fails.
func Liveness() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{
			"status": "alive",
		})
	}
}

// Readiness returns a handler at /readyz that verifies all critical dependencies
// are reachable before the pod is added to the load balancer.
//
// Checks performed:
//   - Postgres ping (required)
//   - Redis ping (required — rate limiting and session state depend on it)
//   - At least one LLM provider whose circuit breaker is not open (required)
//   - AI service HTTP /health (optional — logged but does not block 200)
//
// The LLM check reads breaker state rather than calling the providers: /readyz
// is polled every few seconds by the orchestrator, and probing three paid APIs
// on that cadence would cost real money and add provider rate-limit pressure to
// a service that is already degraded. The breakers are fed by real traffic
// outcomes, so their state is a truer signal than a synthetic ping anyway.
//
// Returns 503 if Postgres or Redis is unreachable, or if every LLM provider has
// tripped — an instance that cannot answer a chat request should not be in the
// load balancer.
func Readiness(db *pgxpool.Pool, rdb *redis.Client, aiServiceURL string, providers *circuit.ProviderRegistry) http.HandlerFunc {
	client := &http.Client{Timeout: 3 * time.Second}

	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		checks := map[string]string{}
		ready := true

		// ── Postgres ──
		if err := db.Ping(ctx); err != nil {
			log.Error().Err(err).Msg("Readiness: postgres ping failed")
			checks["postgres"] = "down"
			ready = false
		} else {
			checks["postgres"] = "up"
		}

		// ── Redis ──
		if err := rdb.Ping(ctx).Err(); err != nil {
			log.Error().Err(err).Msg("Readiness: redis ping failed")
			checks["redis"] = "down"
			ready = false
		} else {
			checks["redis"] = "up"
		}

		// ── LLM providers ──
		if providers != nil && providers.Len() > 0 {
			if providers.AnyAvailable() {
				checks["llm_providers"] = "up"
			} else {
				log.Error().Msg("Readiness: every LLM provider circuit breaker is open")
				checks["llm_providers"] = "down"
				ready = false
			}
		}

		// ── AI service (non-critical) ──
		if aiServiceURL != "" {
			resp, err := client.Get(aiServiceURL + "/health")
			if err != nil || resp.StatusCode >= 500 {
				log.Warn().Err(err).Str("url", aiServiceURL).Msg("Readiness: AI service unreachable (non-critical)")
				checks["ai_service"] = "degraded"
			} else {
				resp.Body.Close()
				checks["ai_service"] = "up"
			}
		}

		statusCode := http.StatusOK
		status := "ready"
		if !ready {
			statusCode = http.StatusServiceUnavailable
			status = "not_ready"
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)
		body := map[string]interface{}{
			"status":   status,
			"services": checks,
		}
		if providers != nil && providers.Len() > 0 {
			// Per-provider detail so an operator can see *which* provider tripped
			// without reaching for Grafana.
			body["llm"] = providers.Snapshot()
		}

		json.NewEncoder(w).Encode(body)
	}
}

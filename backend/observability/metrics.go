// Package observability exposes Prometheus metrics for the InBridge backend.
// All metric names are prefixed with "inbridge_" and carry safe, non-PII labels.
package observability

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// ── HTTP metrics ──────────────────────────────────────────────────────────────

// RequestDuration tracks per-endpoint latency as a histogram.
// Labels: method (GET/POST/…), path (normalised route), status (200/400/…).
var RequestDuration = promauto.NewHistogramVec(
	prometheus.HistogramOpts{
		Name:    "inbridge_http_request_duration_seconds",
		Help:    "Duration of HTTP requests in seconds, broken down by method, path and status code.",
		Buckets: prometheus.DefBuckets, // .005 .01 .025 .05 .1 .25 .5 1 2.5 5 10
	},
	[]string{"method", "path", "status"},
)

// ErrorsTotal counts requests that resulted in an error (status >= 400).
// Labels: method, path, status.
var ErrorsTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "inbridge_http_errors_total",
		Help: "Total number of HTTP error responses (4xx / 5xx), broken down by method, path and status.",
	},
	[]string{"method", "path", "status"},
)

// ── LLM / AI metrics ─────────────────────────────────────────────────────────

// LLMRequestsTotal counts successful completions per LLM provider.
// Labels: provider (anthropic / gemini / groq).
var LLMRequestsTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "inbridge_llm_requests_total",
		Help: "Total number of LLM completions served, labelled by the provider that handled the request.",
	},
	[]string{"provider"},
)

// LLMFailoversTotal counts how many times the router switched providers.
// Labels: from_provider, to_provider.
var LLMFailoversTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "inbridge_llm_failovers_total",
		Help: "Total number of LLM provider failover events.",
	},
	[]string{"from_provider", "to_provider"},
)

// ── RAG cache metrics ─────────────────────────────────────────────────────────

// RAGCacheHitsTotal counts vector-store / query cache hits.
var RAGCacheHitsTotal = promauto.NewCounter(
	prometheus.CounterOpts{
		Name: "inbridge_rag_cache_hits_total",
		Help: "Total number of RAG query cache hits (repeated queries served without re-embedding).",
	},
)

// RAGCacheMissesTotal counts cache misses that required full RAG retrieval.
var RAGCacheMissesTotal = promauto.NewCounter(
	prometheus.CounterOpts{
		Name: "inbridge_rag_cache_misses_total",
		Help: "Total number of RAG query cache misses that triggered a full vector retrieval.",
	},
)

// ── Circuit-breaker metrics ───────────────────────────────────────────────────

// CircuitBreakerStateChanges counts CB transitions.
// Labels: name (the breaker name), state (closed / half-open / open).
var CircuitBreakerStateChanges = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "inbridge_circuit_breaker_state_changes_total",
		Help: "Total number of circuit breaker state transitions.",
	},
	[]string{"name", "state"},
)

// CircuitBreakerOpen is a gauge that is 1 when the named CB is open, 0 otherwise.
var CircuitBreakerOpen = promauto.NewGaugeVec(
	prometheus.GaugeOpts{
		Name: "inbridge_circuit_breaker_open",
		Help: "1 if the named circuit breaker is currently open (blocking requests), 0 otherwise.",
	},
	[]string{"name"},
)

// ── Alerting counters (read by the alerter to derive rates) ──────────────────

// AlertsFiredTotal counts webhook alerts sent.
// Labels: reason (error_rate / failover_spike).
var AlertsFiredTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "inbridge_alerts_fired_total",
		Help: "Total number of webhook alerts fired, labelled by trigger reason.",
	},
	[]string{"reason"},
)

// ── Handler ───────────────────────────────────────────────────────────────────

// Handler returns the standard Prometheus HTTP handler for /metrics.
func Handler() http.Handler {
	return promhttp.Handler()
}

// ── LLM latency & outcome ─────────────────────────────────────────────────────

// LLMRequestDuration tracks end-to-end LLM completion latency per provider.
// Labels: provider, outcome (success / error).
var LLMRequestDuration = promauto.NewHistogramVec(
	prometheus.HistogramOpts{
		Name: "inbridge_llm_request_duration_seconds",
		Help: "Duration of LLM completions in seconds, by provider and outcome.",
		// LLM calls are far slower than HTTP CRUD — use wider buckets than DefBuckets.
		Buckets: []float64{0.25, 0.5, 1, 2, 3, 5, 8, 12, 20, 30, 60},
	},
	[]string{"provider", "outcome"},
)

// LLMErrorsTotal counts failed LLM attempts per provider.
// A failover event produces one error here (the provider that failed) plus one
// LLMFailoversTotal increment (the from→to transition).
var LLMErrorsTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "inbridge_llm_errors_total",
		Help: "Total number of failed LLM attempts, labelled by provider and error kind.",
	},
	[]string{"provider", "kind"},
)

// ── RAG retrieval ─────────────────────────────────────────────────────────────

// RAGRetrievalDuration tracks context-retrieval latency.
// Labels: source (cache / vector_store / tavily_search / llm_direct).
var RAGRetrievalDuration = promauto.NewHistogramVec(
	prometheus.HistogramOpts{
		Name:    "inbridge_rag_retrieval_duration_seconds",
		Help:    "Duration of RAG context retrieval in seconds, by resolved source.",
		Buckets: []float64{0.005, 0.025, 0.1, 0.25, 0.5, 1, 2, 4, 8},
	},
	[]string{"source"},
)

// ── Telemetry ingest ──────────────────────────────────────────────────────────

// TelemetryEventsTotal counts events accepted from the Next.js chat plane.
// Labels: type (llm_request / llm_failover / rag_cache), status (accepted / rejected).
var TelemetryEventsTotal = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "inbridge_telemetry_events_total",
		Help: "Total telemetry events received from the chat plane, by type and acceptance status.",
	},
	[]string{"type", "status"},
)

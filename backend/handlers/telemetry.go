// Package handlers — telemetry.go accepts LLM and RAG events from the Next.js
// chat plane and folds them into the Go process's Prometheus registry.
//
// Why this exists
// ───────────────
// The LLM failover chain and RAG retrieval run in the Next.js route
// (src/lib/ai/router.ts, src/lib/rag-engine.ts), not in this process. Two facts
// make it wrong to hold those counters there:
//
//  1. The Next.js runtime is per-request and ephemeral on Vercel. A counter in
//     that process is reset on every cold start, so `rate()` over it is noise.
//  2. The alerter (alerting/webhook.go) reads LLMFailoversTotal directly from
//     this process's registry. A counter living anywhere else can never fire the
//     failover-spike alert.
//
// So the chat plane emits events here, fire-and-forget, and this process owns
// the counters that Prometheus scrapes and the alerter reads.
package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/MeitY/inbridge-backend/observability"
	"github.com/rs/zerolog/log"
)

// maxTelemetryBody caps the ingest payload (events are tiny; this is ~200 events).
const maxTelemetryBody = 64 << 10 // 64 KiB

// maxEventsPerBatch bounds work per request regardless of body size.
const maxEventsPerBatch = 200

// Event kinds accepted by the ingest endpoint.
const (
	eventLLMRequest  = "llm_request"
	eventLLMFailover = "llm_failover"
	eventRAGCache    = "rag_cache"
)

// allowedProviders is a strict allowlist for the `provider` Prometheus label.
//
// Label values from a network client are untrusted input: accepting arbitrary
// strings would let a caller mint unbounded series and blow up the TSDB. Any
// provider added to src/lib/ai/router.ts must be added here too, or its events
// are rejected rather than silently creating a new series.
var allowedProviders = map[string]bool{
	"anthropic": true,
	"gemini":    true,
	"groq":      true,
}

// allowedRAGSources mirrors the RAGEngine's resolved source values.
var allowedRAGSources = map[string]bool{
	"cache":         true,
	"vector_store":  true,
	"tavily_search": true,
	"llm_direct":    true,
}

// allowedErrorKinds bounds the `kind` label on LLMErrorsTotal.
var allowedErrorKinds = map[string]bool{
	"missing_key": true,
	"api_error":   true,
	"timeout":     true,
	"rate_limit":  true,
	"unknown":     true,
}

// TelemetryEvent is one observation from the chat plane.
type TelemetryEvent struct {
	Type string `json:"type"`

	// llm_request
	Provider   string  `json:"provider,omitempty"`
	Outcome    string  `json:"outcome,omitempty"` // success | error
	DurationMS float64 `json:"duration_ms,omitempty"`

	// llm_failover
	From string `json:"from,omitempty"`
	To   string `json:"to,omitempty"`

	// llm_request(error) and llm_failover
	Kind string `json:"kind,omitempty"`

	// rag_cache
	Result string `json:"result,omitempty"` // hit | miss
	Source string `json:"source,omitempty"`
}

// TelemetryBatch is the request body.
type TelemetryBatch struct {
	Events []TelemetryEvent `json:"events"`
}

// TelemetryIngest returns the POST /internal/telemetry/llm handler.
//
// It always responds 202 for a well-formed batch: telemetry must never become a
// source of failure for the chat request that emitted it. Individual malformed
// events are counted as rejected and dropped.
func TelemetryIngest() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()

		var batch TelemetryBatch
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxTelemetryBody))
		if err := dec.Decode(&batch); err != nil {
			log.Warn().Err(err).Msg("Telemetry: malformed batch")
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "malformed telemetry batch"})
			return
		}

		if len(batch.Events) > maxEventsPerBatch {
			batch.Events = batch.Events[:maxEventsPerBatch]
		}

		accepted, rejected := 0, 0
		for _, ev := range batch.Events {
			if recordEvent(ev) {
				accepted++
				observability.TelemetryEventsTotal.WithLabelValues(ev.Type, "accepted").Inc()
			} else {
				rejected++
				// Label with a constant, not ev.Type: an attacker-controlled type
				// string would otherwise create unbounded series here.
				observability.TelemetryEventsTotal.WithLabelValues("invalid", "rejected").Inc()
			}
		}

		if rejected > 0 {
			log.Warn().Int("accepted", accepted).Int("rejected", rejected).Msg("Telemetry: batch had rejected events")
		}

		writeJSON(w, http.StatusAccepted, map[string]int{
			"accepted": accepted,
			"rejected": rejected,
		})
	}
}

// recordEvent folds a single event into the Prometheus registry.
// Returns false if the event is malformed or carries a label value outside the
// allowlists, in which case nothing is recorded.
func recordEvent(ev TelemetryEvent) bool {
	switch ev.Type {

	case eventLLMRequest:
		if !allowedProviders[ev.Provider] {
			return false
		}
		outcome := ev.Outcome
		if outcome != "success" && outcome != "error" {
			return false
		}

		if outcome == "success" {
			observability.LLMRequestsTotal.WithLabelValues(ev.Provider).Inc()
		} else {
			kind := ev.Kind
			if !allowedErrorKinds[kind] {
				kind = "unknown"
			}
			observability.LLMErrorsTotal.WithLabelValues(ev.Provider, kind).Inc()
		}

		if ev.DurationMS > 0 {
			observability.LLMRequestDuration.
				WithLabelValues(ev.Provider, outcome).
				Observe(ev.DurationMS / 1000.0)
		}
		return true

	case eventLLMFailover:
		if !allowedProviders[ev.From] || !allowedProviders[ev.To] {
			return false
		}
		observability.LLMFailoversTotal.WithLabelValues(ev.From, ev.To).Inc()
		return true

	case eventRAGCache:
		switch ev.Result {
		case "hit":
			observability.RAGCacheHitsTotal.Inc()
		case "miss":
			observability.RAGCacheMissesTotal.Inc()
		default:
			return false
		}

		if ev.DurationMS > 0 && allowedRAGSources[ev.Source] {
			observability.RAGRetrievalDuration.
				WithLabelValues(ev.Source).
				Observe(ev.DurationMS / 1000.0)
		}
		return true

	default:
		return false
	}
}

// writeJSON is a small helper shared by the telemetry handlers.
func writeJSON(w http.ResponseWriter, status int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// telemetryClientTimeout documents the deadline the TS emitter should use.
// Kept here so both sides of the contract are visible in one file.
const telemetryClientTimeout = 2 * time.Second

var _ = telemetryClientTimeout

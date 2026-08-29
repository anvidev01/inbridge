package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/MeitY/inbridge-backend/circuit"
	"github.com/MeitY/inbridge-backend/handlers"
	"github.com/MeitY/inbridge-backend/middleware"
	"github.com/MeitY/inbridge-backend/observability"
	"github.com/go-chi/chi/v5"
)

const testToken = "integration-token"

// newTestRouter wires the same middleware chain and internal routes main.go
// mounts, minus the DB-backed routes, so the telemetry → breaker → metrics loop
// can be exercised over real HTTP.
func newTestRouter(reg *circuit.ProviderRegistry) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.MetricsMiddleware)

	r.Get("/metrics", observability.Handler().ServeHTTP)
	r.Get("/healthz", handlers.Liveness())

	r.Route("/internal", func(r chi.Router) {
		r.Use(middleware.InternalAuth(testToken))
		r.Post("/telemetry/llm", handlers.TelemetryIngest(reg))
		r.Get("/llm/providers", handlers.LLMProviderHealth(reg))
	})

	return r
}

func post(t *testing.T, h http.Handler, path, token, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set(middleware.InternalTokenHeader, token)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func get(t *testing.T, h http.Handler, path, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if token != "" {
		req.Header.Set(middleware.InternalTokenHeader, token)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

// TestChatPlaneTelemetryLoop walks the whole path the roadmap depends on:
// the chat plane reports a failover, the counters Prometheus scrapes move, the
// breaker trips, and the provider-health endpoint reports the provider skipped.
func TestChatPlaneTelemetryLoop(t *testing.T) {
	// These collectors are process-global and shared with the other tests in this
	// binary, so reset every series this test asserts on.
	observability.LLMRequestsTotal.Reset()
	observability.LLMFailoversTotal.Reset()
	observability.LLMErrorsTotal.Reset()
	observability.CircuitBreakerOpen.Reset()

	reg := circuit.NewProviderRegistry([]string{"anthropic", "gemini", "groq"})
	router := newTestRouter(reg)

	// A realistic batch: anthropic fails, we fail over to gemini, gemini serves,
	// and the RAG lookup missed cache.
	body := `{"events":[
		{"type":"rag_cache","result":"miss","source":"vector_store","duration_ms":143},
		{"type":"llm_request","provider":"anthropic","outcome":"error","kind":"api_error","duration_ms":2100},
		{"type":"llm_failover","from":"anthropic","to":"gemini","kind":"api_error"},
		{"type":"llm_request","provider":"gemini","outcome":"success","duration_ms":1650}
	]}`

	rec := post(t, router, "/internal/telemetry/llm", testToken, body)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("ingest returned %d: %s", rec.Code, rec.Body.String())
	}

	// /metrics must now expose the series the Grafana dashboard queries.
	metrics := get(t, router, "/metrics", "").Body.String()
	for _, want := range []string{
		`inbridge_llm_requests_total{provider="gemini"} 1`,
		`inbridge_llm_failovers_total{from_provider="anthropic",to_provider="gemini"} 1`,
		`inbridge_llm_errors_total{kind="api_error",provider="anthropic"} 1`,
		`inbridge_rag_cache_misses_total`,
	} {
		if !strings.Contains(metrics, want) {
			t.Errorf("/metrics is missing %q", want)
		}
	}

	// Two more anthropic failures reach the trip threshold of 3.
	post(t, router, "/internal/telemetry/llm", testToken, `{"events":[
		{"type":"llm_request","provider":"anthropic","outcome":"error","kind":"api_error"},
		{"type":"llm_request","provider":"anthropic","outcome":"error","kind":"api_error"}
	]}`)

	rec = get(t, router, "/internal/llm/providers", testToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("provider health returned %d", rec.Code)
	}

	var health struct {
		Available []string `json:"available"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&health); err != nil {
		t.Fatalf("decode health: %v", err)
	}

	for _, p := range health.Available {
		if p == "anthropic" {
			t.Fatalf("anthropic should be skipped after 3 failures, got available=%v", health.Available)
		}
	}
	if len(health.Available) != 2 {
		t.Fatalf("expected gemini and groq still available, got %v", health.Available)
	}

	// The breaker's open state must also be visible to Grafana.
	metrics = get(t, router, "/metrics", "").Body.String()
	if !strings.Contains(metrics, `inbridge_circuit_breaker_open{name="llm-anthropic"} 1`) {
		t.Error("/metrics should report the anthropic breaker as open")
	}
}

// TestInternalRoutesRequireToken confirms the guard is actually mounted on the
// internal routes rather than only unit-tested in isolation.
func TestInternalRoutesRequireToken(t *testing.T) {
	router := newTestRouter(circuit.NewProviderRegistry([]string{"anthropic"}))

	if rec := post(t, router, "/internal/telemetry/llm", "", `{"events":[]}`); rec.Code != http.StatusUnauthorized {
		t.Errorf("unauthenticated ingest returned %d, want 401", rec.Code)
	}
	if rec := post(t, router, "/internal/telemetry/llm", "wrong", `{"events":[]}`); rec.Code != http.StatusUnauthorized {
		t.Errorf("bad-token ingest returned %d, want 401", rec.Code)
	}
	if rec := get(t, router, "/internal/llm/providers", ""); rec.Code != http.StatusUnauthorized {
		t.Errorf("unauthenticated health returned %d, want 401", rec.Code)
	}
	// The probe endpoints stay public.
	if rec := get(t, router, "/healthz", ""); rec.Code != http.StatusOK {
		t.Errorf("healthz returned %d, want 200", rec.Code)
	}
}

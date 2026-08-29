package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/MeitY/inbridge-backend/circuit"
	"github.com/MeitY/inbridge-backend/observability"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
)

func counterValue(c prometheus.Collector) float64 {
	ch := make(chan prometheus.Metric, 256)
	go func() {
		c.Collect(ch)
		close(ch)
	}()
	var total float64
	for m := range ch {
		var d dto.Metric
		if err := m.Write(&d); err == nil && d.Counter != nil {
			total += d.Counter.GetValue()
		}
	}
	return total
}

func postBatch(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()
	return postBatchTo(t, nil, body)
}

func postBatchTo(t *testing.T, providers *circuit.ProviderRegistry, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/internal/telemetry/llm", strings.NewReader(body))
	rec := httptest.NewRecorder()
	TelemetryIngest(providers)(rec, req)
	return rec
}

func decodeCounts(t *testing.T, rec *httptest.ResponseRecorder) map[string]int {
	t.Helper()
	var out map[string]int
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return out
}

func TestTelemetryIngestRecordsProviderAndFailover(t *testing.T) {
	observability.LLMRequestsTotal.Reset()
	observability.LLMFailoversTotal.Reset()

	rec := postBatch(t, `{"events":[
		{"type":"llm_request","provider":"anthropic","outcome":"error","kind":"api_error","duration_ms":900},
		{"type":"llm_failover","from":"anthropic","to":"gemini"},
		{"type":"llm_request","provider":"gemini","outcome":"success","duration_ms":1200}
	]}`)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", rec.Code)
	}
	counts := decodeCounts(t, rec)
	if counts["accepted"] != 3 || counts["rejected"] != 0 {
		t.Fatalf("expected 3 accepted / 0 rejected, got %v", counts)
	}

	if got := counterValue(observability.LLMRequestsTotal); got != 1 {
		t.Fatalf("expected 1 successful completion recorded, got %v", got)
	}
	if got := counterValue(observability.LLMFailoversTotal); got != 1 {
		t.Fatalf("expected 1 failover recorded, got %v", got)
	}
}

// TestTelemetryIngestRejectsUnknownProvider is the cardinality guard: a caller
// must not be able to mint arbitrary `provider` label values.
func TestTelemetryIngestRejectsUnknownProvider(t *testing.T) {
	observability.LLMRequestsTotal.Reset()

	rec := postBatch(t, `{"events":[
		{"type":"llm_request","provider":"attacker-controlled-value","outcome":"success"},
		{"type":"llm_failover","from":"anthropic","to":"not-a-provider"},
		{"type":"totally_unknown_type","provider":"anthropic"}
	]}`)

	counts := decodeCounts(t, rec)
	if counts["accepted"] != 0 || counts["rejected"] != 3 {
		t.Fatalf("expected all 3 rejected, got %v", counts)
	}
	if got := counterValue(observability.LLMRequestsTotal); got != 0 {
		t.Fatalf("rejected events must not create series, got %v", got)
	}
}

func TestTelemetryIngestRAGCache(t *testing.T) {
	before := counterValue(observability.RAGCacheHitsTotal)

	rec := postBatch(t, `{"events":[
		{"type":"rag_cache","result":"hit","source":"cache","duration_ms":2},
		{"type":"rag_cache","result":"miss","source":"vector_store","duration_ms":140},
		{"type":"rag_cache","result":"sideways"}
	]}`)

	counts := decodeCounts(t, rec)
	if counts["accepted"] != 2 || counts["rejected"] != 1 {
		t.Fatalf("expected 2 accepted / 1 rejected, got %v", counts)
	}
	if got := counterValue(observability.RAGCacheHitsTotal); got != before+1 {
		t.Fatalf("expected hit counter to advance by 1, got %v (was %v)", got, before)
	}
}

// TestTelemetryIngestCapsBatch ensures a huge batch cannot pin the CPU.
func TestTelemetryIngestCapsBatch(t *testing.T) {
	var buf bytes.Buffer
	buf.WriteString(`{"events":[`)
	for i := 0; i < maxEventsPerBatch+50; i++ {
		if i > 0 {
			buf.WriteString(",")
		}
		buf.WriteString(`{"type":"rag_cache","result":"miss"}`)
	}
	buf.WriteString(`]}`)

	rec := postBatch(t, buf.String())
	counts := decodeCounts(t, rec)
	if counts["accepted"] != maxEventsPerBatch {
		t.Fatalf("expected batch capped at %d, got %v", maxEventsPerBatch, counts)
	}
}

func TestTelemetryIngestMalformedBody(t *testing.T) {
	rec := postBatch(t, `{"events": not json`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for malformed body, got %d", rec.Code)
	}
}

// TestTelemetryIngestFeedsProviderBreakers verifies the loop that makes the
// breaker useful: the chat plane performs the LLM call, so reported outcomes are
// the only thing that can trip a provider's breaker.
func TestTelemetryIngestFeedsProviderBreakers(t *testing.T) {
	reg := circuit.NewProviderRegistry([]string{"anthropic", "gemini", "groq"})

	if !reg.Available("anthropic") {
		t.Fatal("a fresh breaker should be closed")
	}

	// Three consecutive failures is the trip threshold.
	postBatchTo(t, reg, `{"events":[
		{"type":"llm_request","provider":"anthropic","outcome":"error","kind":"api_error"},
		{"type":"llm_request","provider":"anthropic","outcome":"error","kind":"api_error"},
		{"type":"llm_request","provider":"anthropic","outcome":"error","kind":"api_error"}
	]}`)

	if reg.Available("anthropic") {
		t.Fatal("anthropic should be open after 3 consecutive failures")
	}
	if !reg.Available("gemini") {
		t.Fatal("gemini must be unaffected by anthropic's failures")
	}
	if !reg.AnyAvailable() {
		t.Fatal("readiness should still pass while other providers are healthy")
	}
}

// TestTelemetryIngestSuccessResetsFailureStreak guards against a provider being
// tripped by failures scattered between successful requests.
func TestTelemetryIngestSuccessResetsFailureStreak(t *testing.T) {
	reg := circuit.NewProviderRegistry([]string{"groq"})

	postBatchTo(t, reg, `{"events":[
		{"type":"llm_request","provider":"groq","outcome":"error","kind":"api_error"},
		{"type":"llm_request","provider":"groq","outcome":"error","kind":"api_error"},
		{"type":"llm_request","provider":"groq","outcome":"success"},
		{"type":"llm_request","provider":"groq","outcome":"error","kind":"api_error"},
		{"type":"llm_request","provider":"groq","outcome":"error","kind":"api_error"}
	]}`)

	if !reg.Available("groq") {
		t.Fatal("interleaved successes should keep the breaker closed")
	}
}

func TestLLMProviderHealthEndpoint(t *testing.T) {
	reg := circuit.NewProviderRegistry([]string{"anthropic", "gemini"})
	postBatchTo(t, reg, `{"events":[
		{"type":"llm_request","provider":"gemini","outcome":"error","kind":"timeout"},
		{"type":"llm_request","provider":"gemini","outcome":"error","kind":"timeout"},
		{"type":"llm_request","provider":"gemini","outcome":"error","kind":"timeout"}
	]}`)

	req := httptest.NewRequest(http.MethodGet, "/internal/llm/providers", nil)
	rec := httptest.NewRecorder()
	LLMProviderHealth(reg)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body struct {
		Providers []circuit.ProviderStatus `json:"providers"`
		Available []string                 `json:"available"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if len(body.Available) != 1 || body.Available[0] != "anthropic" {
		t.Fatalf("expected only anthropic available, got %v", body.Available)
	}
	if len(body.Providers) != 2 {
		t.Fatalf("expected 2 providers in snapshot, got %d", len(body.Providers))
	}
}

// TestLLMProviderHealthNilRegistry covers the disabled-breakers deployment.
func TestLLMProviderHealthNilRegistry(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/internal/llm/providers", nil)
	rec := httptest.NewRecorder()
	LLMProviderHealth(nil)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 with a nil registry, got %d", rec.Code)
	}
}

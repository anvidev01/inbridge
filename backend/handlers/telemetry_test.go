package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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
	req := httptest.NewRequest(http.MethodPost, "/internal/telemetry/llm", strings.NewReader(body))
	rec := httptest.NewRecorder()
	TelemetryIngest()(rec, req)
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

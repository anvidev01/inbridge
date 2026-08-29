package observability

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
)

// dashboardPath is the provisioned Grafana dashboard, relative to this package.
const dashboardPath = "../../infra/observability/grafana/dashboards/inbridge.json"

type dashboard struct {
	Panels []struct {
		Title   string `json:"title"`
		Type    string `json:"type"`
		Targets []struct {
			Expr string `json:"expr"`
		} `json:"targets"`
	} `json:"panels"`
}

// metricRef matches an inbridge_* series name inside a PromQL expression.
var metricRef = regexp.MustCompile(`inbridge_[a-z0-9_]+`)

// histogram/summary suffixes Prometheus derives from a single registered metric.
var derivedSuffixes = []string{"_bucket", "_count", "_sum"}

// registeredMetricNames gathers every metric name the process actually exposes
// on /metrics.
func registeredMetricNames(t *testing.T) map[string]bool {
	t.Helper()

	families, err := prometheus.DefaultGatherer.Gather()
	if err != nil {
		t.Fatalf("gather default registry: %v", err)
	}

	names := make(map[string]bool, len(families))
	for _, f := range families {
		names[f.GetName()] = true
	}
	return names
}

// exists reports whether a dashboard's metric reference resolves to a
// registered metric, allowing for the _bucket/_count/_sum series Prometheus
// derives from histograms.
func exists(ref string, registered map[string]bool) bool {
	if registered[ref] {
		return true
	}
	for _, suffix := range derivedSuffixes {
		if strings.HasSuffix(ref, suffix) && registered[strings.TrimSuffix(ref, suffix)] {
			return true
		}
	}
	return false
}

// TestDashboardMetricsExist is the guard against the failure this dashboard
// already shipped with once: panels querying inbridge_llm_* and
// inbridge_rag_cache_* while nothing incremented them, so the panels were
// permanently empty and nobody noticed.
//
// A metric that is renamed or dropped now fails here instead of silently
// blanking a panel an operator is relying on during an incident.
func TestDashboardMetricsExist(t *testing.T) {
	raw, err := os.ReadFile(filepath.Clean(dashboardPath))
	if err != nil {
		t.Fatalf("read dashboard: %v", err)
	}

	var d dashboard
	if err := json.Unmarshal(raw, &d); err != nil {
		t.Fatalf("parse dashboard: %v", err)
	}

	// Touch every metric vec so it registers at least one series. An unused
	// *Vec reports no metric family to the gatherer, which would make this test
	// pass or fail depending on which other tests ran first.
	warmUp()
	registered := registeredMetricNames(t)

	checked := 0
	for _, panel := range d.Panels {
		for _, target := range panel.Targets {
			for _, ref := range metricRef.FindAllString(target.Expr, -1) {
				checked++
				if !exists(ref, registered) {
					t.Errorf("panel %q queries %q, which this process does not expose", panel.Title, ref)
				}
			}
		}
	}

	if checked == 0 {
		t.Fatal("no inbridge_* metric references found — is the dashboard path correct?")
	}
	t.Logf("verified %d metric references across %d panels", checked, len(d.Panels))
}

// warmUp instantiates one child series per metric vec so the gatherer reports
// every family. Values are irrelevant; only registration matters.
func warmUp() {
	RequestDuration.WithLabelValues("GET", "/warmup", "200")
	ErrorsTotal.WithLabelValues("GET", "/warmup", "500")
	LLMRequestsTotal.WithLabelValues("anthropic")
	LLMFailoversTotal.WithLabelValues("anthropic", "gemini")
	LLMRequestDuration.WithLabelValues("anthropic", "success")
	LLMErrorsTotal.WithLabelValues("anthropic", "api_error")
	RAGRetrievalDuration.WithLabelValues("cache")
	CircuitBreakerStateChanges.WithLabelValues("llm-anthropic", "open")
	CircuitBreakerOpen.WithLabelValues("llm-anthropic")
	AlertsFiredTotal.WithLabelValues("error_rate")
	TelemetryEventsTotal.WithLabelValues("llm_request", "accepted")
	RAGCacheHitsTotal.Add(0)
	RAGCacheMissesTotal.Add(0)
}

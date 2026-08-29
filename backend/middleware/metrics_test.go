package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/MeitY/inbridge-backend/observability"
	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
)

// countSeries returns how many distinct label sets exist on a collector.
func countSeries(c prometheus.Collector) int {
	ch := make(chan prometheus.Metric, 1024)
	go func() {
		c.Collect(ch)
		close(ch)
	}()
	n := 0
	for range ch {
		n++
	}
	return n
}

// labelValues returns the value of the named label across all series.
func labelValues(c prometheus.Collector, label string) map[string]bool {
	ch := make(chan prometheus.Metric, 1024)
	go func() {
		c.Collect(ch)
		close(ch)
	}()
	out := map[string]bool{}
	for m := range ch {
		var d dto.Metric
		if err := m.Write(&d); err != nil {
			continue
		}
		for _, lp := range d.GetLabel() {
			if lp.GetName() == label {
				out[lp.GetValue()] = true
			}
		}
	}
	return out
}

// TestMetricsMiddlewareCollapsesPathParams is the regression test for the
// cardinality bug: labelling by r.URL.Path produced one series per grievance ID.
func TestMetricsMiddlewareCollapsesPathParams(t *testing.T) {
	observability.RequestDuration.Reset()

	r := chi.NewRouter()
	r.Use(MetricsMiddleware)
	r.Get("/api/v1/grievance/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// Three distinct IDs must collapse into one series.
	for _, id := range []string{"aaa-111", "bbb-222", "ccc-333"} {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/grievance/"+id, nil)
		r.ServeHTTP(httptest.NewRecorder(), req)
	}

	if got := countSeries(observability.RequestDuration); got != 1 {
		t.Fatalf("expected 1 series for 3 distinct IDs, got %d", got)
	}

	paths := labelValues(observability.RequestDuration, "path")
	if !paths["/api/v1/grievance/{id}"] {
		t.Fatalf("expected route pattern label, got %v", paths)
	}
}

// TestMetricsMiddlewareUnmatchedRoutes ensures 404 traffic (scanners probing
// random URLs) cannot mint one series per probed path.
func TestMetricsMiddlewareUnmatchedRoutes(t *testing.T) {
	observability.RequestDuration.Reset()
	observability.ErrorsTotal.Reset()

	r := chi.NewRouter()
	r.Use(MetricsMiddleware)
	r.Get("/api/v1/services", func(w http.ResponseWriter, r *http.Request) {})

	for _, p := range []string{"/wp-admin", "/.env", "/phpmyadmin", "/etc/passwd"} {
		req := httptest.NewRequest(http.MethodGet, p, nil)
		r.ServeHTTP(httptest.NewRecorder(), req)
	}

	if got := countSeries(observability.RequestDuration); got != 1 {
		t.Fatalf("expected 4 unmatched paths to collapse to 1 series, got %d", got)
	}
	paths := labelValues(observability.RequestDuration, "path")
	if !paths["unmatched"] {
		t.Fatalf("expected 'unmatched' label, got %v", paths)
	}
	if got := countSeries(observability.ErrorsTotal); got != 1 {
		t.Fatalf("expected 1 error series for 404s, got %d", got)
	}
}

// TestMetricsMiddlewareSkipsProbes verifies probe traffic stays out of the
// latency histogram so it cannot drag p95 toward zero.
func TestMetricsMiddlewareSkipsProbes(t *testing.T) {
	observability.RequestDuration.Reset()

	r := chi.NewRouter()
	r.Use(MetricsMiddleware)
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {})
	r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {})
	r.Get("/metrics", func(w http.ResponseWriter, r *http.Request) {})

	for _, p := range []string{"/healthz", "/readyz", "/metrics"} {
		r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, p, nil))
	}

	if got := countSeries(observability.RequestDuration); got != 0 {
		t.Fatalf("probe traffic should not be recorded, got %d series", got)
	}
}

// TestStatusRecorderCapturesImplicit200 covers the handler that writes a body
// without ever calling WriteHeader.
func TestStatusRecorderCapturesImplicit200(t *testing.T) {
	observability.RequestDuration.Reset()

	r := chi.NewRouter()
	r.Use(MetricsMiddleware)
	r.Get("/api/v1/services", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("[]"))
	})

	r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/v1/services", nil))

	statuses := labelValues(observability.RequestDuration, "status")
	if !statuses["200"] {
		t.Fatalf("expected implicit 200 to be recorded, got %v", statuses)
	}
}

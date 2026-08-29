// Package middleware — MetricsMiddleware instruments every HTTP request with
// Prometheus request-duration histograms and error counters.
// Paths /metrics, /healthz, and /readyz are excluded from latency tracking
// to avoid polluting percentile buckets with probe traffic.
package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/MeitY/inbridge-backend/observability"
	"github.com/go-chi/chi/v5"
)

// skipMetricsPaths holds routes that should not be tracked in latency histograms.
var skipMetricsPaths = map[string]bool{
	"/metrics": true,
	"/healthz": true,
	"/readyz":  true,
}

// MetricsMiddleware wraps each HTTP handler, capturing:
//   - Request duration → RequestDuration histogram
//   - HTTP errors (status >= 400) → ErrorsTotal counter
//
// The "path" label is the chi *route pattern* (e.g. /api/v1/grievance/{id}),
// never the raw URL, so that per-ID paths cannot explode label cardinality.
func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Capture status code via a lightweight recorder.
		rec := &statusRecorder{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rec, r)

		if skipMetricsPaths[r.URL.Path] {
			return
		}

		// Read the matched route pattern *after* the handler has run — chi only
		// fills RouteContext during routing.
		path := NormalisePath(routePattern(r), r.URL.Path)

		method := r.Method
		status := strconv.Itoa(rec.statusCode)
		elapsed := time.Since(start).Seconds()

		observability.RequestDuration.
			WithLabelValues(method, path, status).
			Observe(elapsed)

		if rec.statusCode >= 400 {
			observability.ErrorsTotal.
				WithLabelValues(method, path, status).
				Inc()
		}
	})
}

// routePattern extracts the chi route pattern for the request, if chi routed it.
func routePattern(r *http.Request) string {
	rctx := chi.RouteContext(r.Context())
	if rctx == nil {
		return ""
	}
	return rctx.RoutePattern()
}

// statusRecorder is a minimal ResponseWriter that captures the status code.
// It lives here rather than in masking.go so the two can evolve independently.
type statusRecorder struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

func (sr *statusRecorder) WriteHeader(code int) {
	if sr.written {
		return
	}
	sr.statusCode = code
	sr.written = true
	sr.ResponseWriter.WriteHeader(code)
}

// Write ensures the status code is captured even when WriteHeader is never
// called explicitly (Go's net/http implicitly sends 200 on first Write).
func (sr *statusRecorder) Write(b []byte) (int, error) {
	if !sr.written {
		sr.WriteHeader(http.StatusOK)
	}
	return sr.ResponseWriter.Write(b)
}

// NormalisePath converts a chi route pattern into a bounded, low-cardinality
// Prometheus label value.
//
// Prometheus label cardinality is the product of every label's distinct values,
// so an unbounded "path" label (one series per grievance UUID, one per ARN) will
// grow the TSDB without limit. Every request therefore collapses to one of a
// finite set of route patterns, and anything chi did not route — 404s, probes
// from scanners — collapses to the single constant "unmatched".
func NormalisePath(routePattern, rawPath string) string {
	switch routePattern {
	case "":
		// chi did not match a route (404) — never label with the raw URL.
		return "unmatched"
	case "/*":
		// chi's catch-all: also effectively unrouted.
		return "unmatched"
	default:
		return routePattern
	}
}

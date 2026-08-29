// Package middleware — MetricsMiddleware instruments every HTTP request with
// Prometheus request-duration histograms and error counters.
// Paths /metrics, /healthz, and /readyz are excluded from latency tracking
// to avoid polluting percentile buckets with probe traffic.
package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/MeitY/inbridge-backend/observability"
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
func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Capture status code via a lightweight recorder.
		rec := &statusRecorder{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rec, r)

		path := r.URL.Path
		if skipMetricsPaths[path] {
			return
		}

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

// NormalisePath converts chi URL params like /api/v1/grievance/abc-123 to
// /api/v1/grievance/:id, preventing high-cardinality label explosions.
// Use this in handlers that call observability metrics directly.
func NormalisePath(routePattern, rawPath string) string {
	if routePattern != "" {
		return routePattern
	}
	return fmt.Sprintf("%s (raw)", rawPath)
}

// Package alerting provides a background goroutine that watches Prometheus
// counters and fires Slack/Discord webhook alerts when thresholds are crossed.
//
// Two conditions are monitored on a 60-second ticker:
//  1. HTTP error rate crosses cfg.AlertErrorRateThreshold (default 5%).
//  2. LLM failover count in the last 60s window exceeds cfg.AlertFailoverWindowThreshold (default 3).
//
// The webhook payload is compatible with both Slack and Discord incoming webhooks.
// No PII is included — only aggregate counts and timestamps.
package alerting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/MeitY/inbridge-backend/observability"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/rs/zerolog/log"
)

// Alerter holds the webhook configuration and rolling counters.
type Alerter struct {
	webhookURL              string
	errorRateThreshold      float64
	failoverWindowThreshold int
	httpClient              *http.Client

	// Snapshots from the previous tick (used to compute deltas).
	prevTotalRequests float64
	prevTotalErrors   float64
	prevFailovers     float64
}

// New creates an Alerter with the given thresholds.
func New(webhookURL string, errorRateThreshold float64, failoverWindowThreshold int) *Alerter {
	return &Alerter{
		webhookURL:              webhookURL,
		errorRateThreshold:      errorRateThreshold,
		failoverWindowThreshold: failoverWindowThreshold,
		httpClient:              &http.Client{Timeout: 5 * time.Second},
	}
}

// Run starts the alerting loop and blocks until ctx is cancelled.
// Call this in a goroutine: go alerter.Run(ctx).
func (a *Alerter) Run(ctx context.Context) {
	if a.webhookURL == "" {
		log.Info().Msg("Alerter: ALERT_WEBHOOK_URL not set — webhook alerting disabled")
		return
	}

	log.Info().
		Str("webhook", maskURL(a.webhookURL)).
		Float64("error_rate_threshold", a.errorRateThreshold).
		Int("failover_window_threshold", a.failoverWindowThreshold).
		Msg("Alerter started")

	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Alerter stopped")
			return
		case <-ticker.C:
			a.evaluate()
		}
	}
}

// evaluate reads current Prometheus counter values and fires alerts if needed.
func (a *Alerter) evaluate() {
	totalRequests := sumHistogramVec(observability.RequestDuration)
	totalErrors := sumCounterVec(observability.ErrorsTotal)
	failovers := sumCounterVec(observability.LLMFailoversTotal)

	deltaRequests := totalRequests - a.prevTotalRequests
	deltaErrors := totalErrors - a.prevTotalErrors
	deltaFailovers := failovers - a.prevFailovers

	// Update snapshots.
	a.prevTotalRequests = totalRequests
	a.prevTotalErrors = totalErrors
	a.prevFailovers = failovers

	// ── Check 1: error rate ──
	if deltaRequests > 0 {
		errorRate := deltaErrors / deltaRequests
		if errorRate >= a.errorRateThreshold {
			msg := fmt.Sprintf(
				"🚨 *InBridge Alert* — High error rate detected!\n"+
					"Error rate: *%.1f%%* (threshold: %.1f%%)\n"+
					"Requests in last 60s: %.0f | Errors: %.0f\n"+
					"Time: %s",
				errorRate*100, a.errorRateThreshold*100,
				deltaRequests, deltaErrors,
				time.Now().UTC().Format(time.RFC3339),
			)
			a.fire("error_rate", msg)
		}
	}

	// ── Check 2: failover spike ──
	if int(deltaFailovers) >= a.failoverWindowThreshold {
		msg := fmt.Sprintf(
			"⚠️ *InBridge Alert* — LLM failover spike detected!\n"+
				"Failovers in last 60s: *%.0f* (threshold: %d)\n"+
				"Time: %s",
			deltaFailovers, a.failoverWindowThreshold,
			time.Now().UTC().Format(time.RFC3339),
		)
		a.fire("failover_spike", msg)
	}
}

// fire sends a webhook notification and increments the Prometheus alert counter.
func (a *Alerter) fire(reason, message string) {
	log.Warn().Str("reason", reason).Msg("Alerter: firing webhook")

	payload := map[string]string{"text": message}
	body, _ := json.Marshal(payload)

	resp, err := a.httpClient.Post(a.webhookURL, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Error().Err(err).Str("reason", reason).Msg("Alerter: webhook POST failed")
		return
	}
	resp.Body.Close()

	observability.AlertsFiredTotal.WithLabelValues(reason).Inc()
	log.Info().Str("reason", reason).Int("status", resp.StatusCode).Msg("Alerter: webhook fired")
}

// ── Prometheus helpers ────────────────────────────────────────────────────────

// sumCounterVec reads the current total across all label combinations from a
// CounterVec by gathering the underlying metric family.
func sumCounterVec(c *prometheus.CounterVec) float64 {
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

// sumHistogramVec sums the count field of a HistogramVec (total observations).
func sumHistogramVec(h *prometheus.HistogramVec) float64 {
	ch := make(chan prometheus.Metric, 256)
	go func() {
		h.Collect(ch)
		close(ch)
	}()

	var total float64
	for m := range ch {
		var d dto.Metric
		if err := m.Write(&d); err == nil && d.Histogram != nil {
			total += float64(d.Histogram.GetSampleCount())
		}
	}
	return total
}

// maskURL hides the token/path portion of a webhook URL in logs.
func maskURL(u string) string {
	if len(u) > 30 {
		return u[:30] + "***"
	}
	return "***"
}

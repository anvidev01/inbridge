// Package alerting provides a background goroutine that watches Prometheus
// counters and fires Slack/Discord webhook alerts when thresholds are crossed.
//
// Two conditions are monitored on a ticker:
//  1. HTTP error rate crosses cfg.AlertErrorRateThreshold (default 5%).
//  2. LLM failovers in the window exceed cfg.AlertFailoverWindowThreshold (default 3).
//
// Alerts are stateful. A condition that stays true does not re-notify every
// tick — it fires once, stays quiet for a cooldown, and sends a recovery notice
// when it clears. An alerter that repeats itself every minute during an
// incident trains people to mute the channel, which is worse than not alerting.
//
// No PII is included — only aggregate counts and timestamps.
package alerting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/MeitY/inbridge-backend/observability"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/rs/zerolog/log"
)

// defaultInterval is how often thresholds are evaluated.
const defaultInterval = 60 * time.Second

// defaultCooldown is the minimum gap between two notifications for the same
// reason while the condition remains true.
const defaultCooldown = 15 * time.Minute

// webhookFlavor selects the JSON shape a receiver expects.
type webhookFlavor int

const (
	// flavorSlack sends {"text": "..."} — Slack and most Slack-compatible receivers.
	flavorSlack webhookFlavor = iota
	// flavorDiscord sends {"content": "..."}.
	//
	// Discord rejects a Slack payload with 400 "Cannot send an empty message":
	// it has no "text" field, so the message reads as empty. This package
	// previously sent {"text": ...} to every receiver while documenting itself
	// as compatible with both, which meant Discord alerting silently never
	// worked.
	flavorDiscord
)

// detectFlavor infers the payload shape from the webhook URL.
//
// When the host is unrecognised the Slack shape is the safer default: it is
// what generic receivers and most Slack-compatible services expect.
func detectFlavor(webhookURL string) webhookFlavor {
	u := strings.ToLower(webhookURL)
	if strings.Contains(u, "discord.com") || strings.Contains(u, "discordapp.com") {
		return flavorDiscord
	}
	return flavorSlack
}

// alertState tracks whether a condition is currently firing and when it last
// notified, so repeats are suppressed and recoveries are announced.
type alertState struct {
	firing     bool
	lastNotify time.Time
}

// Alerter holds the webhook configuration and rolling counters.
type Alerter struct {
	webhookURL              string
	errorRateThreshold      float64
	failoverWindowThreshold int
	httpClient              *http.Client
	flavor                  webhookFlavor

	interval time.Duration
	cooldown time.Duration

	// Snapshots from the previous tick (used to compute deltas).
	prevTotalRequests float64
	prevTotalErrors   float64
	prevFailovers     float64

	// Per-reason firing state.
	states map[string]*alertState

	// now is swappable in tests.
	now func() time.Time
}

// New creates an Alerter with the given thresholds.
func New(webhookURL string, errorRateThreshold float64, failoverWindowThreshold int) *Alerter {
	return &Alerter{
		webhookURL:              webhookURL,
		errorRateThreshold:      errorRateThreshold,
		failoverWindowThreshold: failoverWindowThreshold,
		httpClient:              &http.Client{Timeout: 5 * time.Second},
		flavor:                  detectFlavor(webhookURL),
		interval:                defaultInterval,
		cooldown:                defaultCooldown,
		states:                  make(map[string]*alertState),
		now:                     time.Now,
	}
}

// Run starts the alerting loop and blocks until ctx is cancelled.
// Call this in a goroutine: go alerter.Run(ctx).
func (a *Alerter) Run(ctx context.Context) {
	if a.webhookURL == "" {
		log.Info().Msg("Alerter: ALERT_WEBHOOK_URL not set — webhook alerting disabled")
		return
	}

	flavor := "slack"
	if a.flavor == flavorDiscord {
		flavor = "discord"
	}

	log.Info().
		Str("webhook", maskURL(a.webhookURL)).
		Str("flavor", flavor).
		Float64("error_rate_threshold", a.errorRateThreshold).
		Int("failover_window_threshold", a.failoverWindowThreshold).
		Dur("interval", a.interval).
		Dur("cooldown", a.cooldown).
		Msg("Alerter started")

	// Prime the counter snapshots so the first evaluation measures only the
	// interval that follows, not everything since process start.
	a.snapshot()

	ticker := time.NewTicker(a.interval)
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

// snapshot records current counter totals without evaluating thresholds.
func (a *Alerter) snapshot() {
	a.prevTotalRequests = sumHistogramVec(observability.RequestDuration)
	a.prevTotalErrors = sumCounterVec(observability.ErrorsTotal)
	a.prevFailovers = sumCounterVec(observability.LLMFailoversTotal)
}

// evaluate reads current Prometheus counter values and fires alerts if needed.
func (a *Alerter) evaluate() {
	totalRequests := sumHistogramVec(observability.RequestDuration)
	totalErrors := sumCounterVec(observability.ErrorsTotal)
	failovers := sumCounterVec(observability.LLMFailoversTotal)

	deltaRequests := totalRequests - a.prevTotalRequests
	deltaErrors := totalErrors - a.prevTotalErrors
	deltaFailovers := failovers - a.prevFailovers

	a.prevTotalRequests = totalRequests
	a.prevTotalErrors = totalErrors
	a.prevFailovers = failovers

	// ── Check 1: error rate ──
	//
	// Only evaluated when there was traffic. With zero requests the rate is
	// undefined, and treating it as 0 would clear a firing alert purely because
	// the service stopped receiving traffic — which is not a recovery.
	if deltaRequests > 0 {
		errorRate := deltaErrors / deltaRequests
		if errorRate >= a.errorRateThreshold {
			a.trigger("error_rate", fmt.Sprintf(
				"🚨 *InBridge* — High error rate\n"+
					"Error rate: *%.1f%%* (threshold %.1f%%)\n"+
					"Window: %.0f requests, %.0f errors\n"+
					"Time: %s",
				errorRate*100, a.errorRateThreshold*100,
				deltaRequests, deltaErrors,
				a.now().UTC().Format(time.RFC3339),
			))
		} else {
			a.clear("error_rate", fmt.Sprintf(
				"✅ *InBridge* — Error rate recovered\n"+
					"Error rate back to *%.1f%%* (threshold %.1f%%)\n"+
					"Time: %s",
				errorRate*100, a.errorRateThreshold*100,
				a.now().UTC().Format(time.RFC3339),
			))
		}
	}

	// ── Check 2: failover spike ──
	if int(deltaFailovers) >= a.failoverWindowThreshold {
		a.trigger("failover_spike", fmt.Sprintf(
			"⚠️ *InBridge* — LLM failover spike\n"+
				"Failovers in window: *%.0f* (threshold %d)\n"+
				"Check which providers have open circuit breakers on /readyz.\n"+
				"Time: %s",
			deltaFailovers, a.failoverWindowThreshold,
			a.now().UTC().Format(time.RFC3339),
		))
	} else {
		a.clear("failover_spike", fmt.Sprintf(
			"✅ *InBridge* — LLM failovers back to normal\n"+
				"Failovers in window: %.0f (threshold %d)\n"+
				"Time: %s",
			deltaFailovers, a.failoverWindowThreshold,
			a.now().UTC().Format(time.RFC3339),
		))
	}
}

// trigger notifies for a condition that is true, subject to the cooldown.
func (a *Alerter) trigger(reason, message string) {
	st := a.state(reason)
	now := a.now()

	if st.firing && now.Sub(st.lastNotify) < a.cooldown {
		log.Debug().
			Str("reason", reason).
			Dur("since_last", now.Sub(st.lastNotify)).
			Msg("Alerter: condition still firing, suppressed by cooldown")
		return
	}

	st.firing = true
	st.lastNotify = now
	a.send(reason, message)
}

// clear notifies that a previously firing condition has recovered.
// A condition that was never firing produces no message.
func (a *Alerter) clear(reason, message string) {
	st := a.state(reason)
	if !st.firing {
		return
	}

	st.firing = false
	st.lastNotify = a.now()
	a.send(reason+"_resolved", message)
}

func (a *Alerter) state(reason string) *alertState {
	st, ok := a.states[reason]
	if !ok {
		st = &alertState{}
		a.states[reason] = st
	}
	return st
}

// send POSTs the message and increments the Prometheus alert counter.
func (a *Alerter) send(reason, message string) {
	log.Warn().Str("reason", reason).Msg("Alerter: sending webhook")

	body, err := json.Marshal(a.payload(message))
	if err != nil {
		log.Error().Err(err).Str("reason", reason).Msg("Alerter: marshal payload failed")
		return
	}

	resp, err := a.httpClient.Post(a.webhookURL, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Error().Err(err).Str("reason", reason).Msg("Alerter: webhook POST failed")
		return
	}
	defer resp.Body.Close()

	// A 2xx is the only success. Slack and Discord both answer a malformed
	// payload with 400 and a body explaining why; logging that at error level
	// is the difference between noticing broken alerting and believing the
	// service has simply been healthy.
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Error().
			Str("reason", reason).
			Int("status", resp.StatusCode).
			Msg("Alerter: webhook rejected the alert — alerting is not working")
		return
	}

	observability.AlertsFiredTotal.WithLabelValues(reason).Inc()
	log.Info().Str("reason", reason).Int("status", resp.StatusCode).Msg("Alerter: webhook delivered")
}

// payload builds the receiver-specific JSON body.
func (a *Alerter) payload(message string) map[string]string {
	if a.flavor == flavorDiscord {
		return map[string]string{"content": message}
	}
	return map[string]string{"text": message}
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

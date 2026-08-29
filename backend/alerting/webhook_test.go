package alerting

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/MeitY/inbridge-backend/observability"
)

// capture is a fake webhook receiver that records every payload it is sent.
type capture struct {
	mu       sync.Mutex
	payloads []map[string]string
	status   int
}

func (c *capture) handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)

		c.mu.Lock()
		c.payloads = append(c.payloads, body)
		c.mu.Unlock()

		status := c.status
		if status == 0 {
			status = http.StatusOK
		}
		w.WriteHeader(status)
	}
}

func (c *capture) count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.payloads)
}

func (c *capture) last() map[string]string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.payloads) == 0 {
		return nil
	}
	return c.payloads[len(c.payloads)-1]
}

// newTestAlerter wires an Alerter to a fake receiver with a controllable clock.
func newTestAlerter(t *testing.T, c *capture) (*Alerter, *time.Time) {
	t.Helper()

	srv := httptest.NewServer(c.handler())
	t.Cleanup(srv.Close)

	clock := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	a := New(srv.URL, 0.05, 3)
	a.now = func() time.Time { return clock }

	return a, &clock
}

// drive simulates one evaluation window carrying the given deltas.
//
// evaluate() reads the live collectors, so rather than mutating global metrics
// (which would race with every other test in the binary) the previous-tick
// snapshots are seeded to current-minus-delta.
func drive(a *Alerter, requests, errors, failovers float64) {
	a.prevTotalRequests = sumHistogramVec(observability.RequestDuration) - requests
	a.prevTotalErrors = sumCounterVec(observability.ErrorsTotal) - errors
	a.prevFailovers = sumCounterVec(observability.LLMFailoversTotal) - failovers

	a.evaluate()
}

func TestErrorRateAlertFiresOnceAndSuppressesRepeats(t *testing.T) {
	c := &capture{}
	a, clock := newTestAlerter(t, c)

	// 10% error rate against a 5% threshold.
	drive(a, 100, 10, 0)
	if c.count() != 1 {
		t.Fatalf("expected 1 alert, got %d", c.count())
	}

	// Still failing one minute later: the cooldown must suppress it.
	*clock = clock.Add(1 * time.Minute)
	drive(a, 100, 10, 0)
	if c.count() != 1 {
		t.Fatalf("cooldown should suppress repeats, got %d alerts", c.count())
	}

	// Past the cooldown, a still-failing condition notifies again.
	*clock = clock.Add(defaultCooldown + time.Second)
	drive(a, 100, 10, 0)
	if c.count() != 2 {
		t.Fatalf("expected a re-notify after the cooldown, got %d", c.count())
	}
}

func TestErrorRateRecoverySendsResolution(t *testing.T) {
	c := &capture{}
	a, clock := newTestAlerter(t, c)

	drive(a, 100, 10, 0) // fire
	*clock = clock.Add(time.Minute)
	drive(a, 100, 0, 0) // recover

	if c.count() != 2 {
		t.Fatalf("expected fire + resolve, got %d messages", c.count())
	}
	if last := c.last()["text"]; !strings.Contains(last, "recovered") {
		t.Fatalf("expected a recovery message, got %q", last)
	}

	// A second healthy window must stay silent.
	*clock = clock.Add(time.Minute)
	drive(a, 100, 0, 0)
	if c.count() != 2 {
		t.Fatalf("healthy windows must not notify, got %d", c.count())
	}
}

// A condition that was never firing must not produce a recovery message on the
// very first healthy evaluation.
func TestNoResolutionWithoutAPriorAlert(t *testing.T) {
	c := &capture{}
	a, _ := newTestAlerter(t, c)

	drive(a, 100, 0, 0)
	if c.count() != 0 {
		t.Fatalf("a healthy service must send nothing, got %d", c.count())
	}
}

// Zero traffic makes the error rate undefined. Treating it as 0% would clear a
// firing alert purely because traffic stopped, which is not a recovery.
func TestZeroTrafficDoesNotClearAFiringAlert(t *testing.T) {
	c := &capture{}
	a, clock := newTestAlerter(t, c)

	drive(a, 100, 10, 0) // fire
	*clock = clock.Add(time.Minute)
	drive(a, 0, 0, 0) // no traffic at all

	if c.count() != 1 {
		t.Fatalf("zero traffic must not resolve the alert, got %d messages", c.count())
	}
	if !a.states["error_rate"].firing {
		t.Fatal("alert should still be considered firing")
	}
}

func TestFailoverSpikeAlert(t *testing.T) {
	c := &capture{}
	a, clock := newTestAlerter(t, c)

	// Below threshold (3) — silent.
	drive(a, 10, 0, 2)
	if c.count() != 0 {
		t.Fatalf("2 failovers is below the threshold, got %d alerts", c.count())
	}

	*clock = clock.Add(time.Minute)
	drive(a, 10, 0, 3)
	if c.count() != 1 {
		t.Fatalf("3 failovers should alert, got %d", c.count())
	}
	if !strings.Contains(c.last()["text"], "failover") {
		t.Fatalf("unexpected message: %q", c.last()["text"])
	}
}

// The regression this rewrite fixes: Discord rejects {"text": ...} as an empty
// message, so alerts to a Discord webhook silently never arrived.
func TestDiscordWebhookUsesContentField(t *testing.T) {
	cases := []struct {
		url  string
		want webhookFlavor
	}{
		{"https://discord.com/api/webhooks/123/abc", flavorDiscord},
		{"https://discordapp.com/api/webhooks/123/abc", flavorDiscord},
		{"https://hooks.slack.com/services/T/B/X", flavorSlack},
		{"https://example.internal/hook", flavorSlack},
	}
	for _, tc := range cases {
		if got := detectFlavor(tc.url); got != tc.want {
			t.Errorf("detectFlavor(%q) = %v, want %v", tc.url, got, tc.want)
		}
	}

	discord := &Alerter{flavor: flavorDiscord}
	if _, ok := discord.payload("hi")["content"]; !ok {
		t.Errorf("Discord payload must use 'content', got %v", discord.payload("hi"))
	}
	if _, ok := discord.payload("hi")["text"]; ok {
		t.Error("Discord payload must not use 'text'")
	}

	slack := &Alerter{flavor: flavorSlack}
	if _, ok := slack.payload("hi")["text"]; !ok {
		t.Errorf("Slack payload must use 'text', got %v", slack.payload("hi"))
	}
}

// A receiver that rejects the payload must not be counted as a delivered alert,
// or broken alerting looks identical to a healthy service.
func TestRejectedWebhookIsNotCountedAsDelivered(t *testing.T) {
	c := &capture{status: http.StatusBadRequest}
	a, _ := newTestAlerter(t, c)

	observability.AlertsFiredTotal.Reset()
	drive(a, 100, 50, 0)

	if c.count() != 1 {
		t.Fatalf("expected the POST to be attempted once, got %d", c.count())
	}
	if got := sumCounterVec(observability.AlertsFiredTotal); got != 0 {
		t.Fatalf("a rejected webhook must not increment AlertsFiredTotal, got %v", got)
	}
}

func TestDisabledWhenNoWebhookConfigured(t *testing.T) {
	a := New("", 0.05, 3)

	done := make(chan struct{})
	go func() { a.Run(context.Background()); close(done) }()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Run should return immediately when no webhook is configured")
	}
}

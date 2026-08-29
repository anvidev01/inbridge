// Package circuit — providers.go holds one sony/gobreaker breaker per LLM
// provider, so a struggling provider is skipped rather than retried.
//
// Where the breaker sits, and why
// ───────────────────────────────
// The failover chain itself runs in the Next.js route: it is the code that
// holds the provider SDKs and the streaming logic. Putting the breaker state
// there would not work — the Next.js runtime is per-request and ephemeral on
// Vercel, so consecutive-failure counts would reset on every cold start and the
// breaker would never trip.
//
// So the state machine lives here, in the long-lived Go process, fed by the
// outcomes the chat plane already reports to /internal/telemetry/llm. The
// router asks which providers are currently available before building its
// chain and skips the open ones. One authority, one set of counts, and the
// same breaker state is visible on /readyz and in Grafana.
package circuit

import (
	"sort"
	"sync"
	"time"

	"github.com/MeitY/inbridge-backend/observability"
	"github.com/rs/zerolog/log"
	"github.com/sony/gobreaker"
)

const (
	// providerMaxFailures is how many consecutive failures open a provider.
	//
	// Deliberately lower than the AI-service breaker's 5: an LLM provider has
	// two healthy siblings to fall through to, so the cost of opening early is
	// one skipped provider, while the cost of opening late is that every request
	// pays that provider's full timeout before failing over.
	providerMaxFailures = 3

	// providerOpenTimeout is how long a provider stays skipped before one probe
	// is allowed through. Short, because provider blips are usually brief and a
	// needlessly skipped primary costs answer quality.
	providerOpenTimeout = 20 * time.Second

	// providerHalfOpenProbes is how many requests may test a recovering provider.
	providerHalfOpenProbes = 1

	// providerCountInterval resets consecutive-failure counts in the closed
	// state, so failures spread thinly over an hour never accumulate into a trip.
	providerCountInterval = 60 * time.Second
)

// ProviderStatus is the externally visible state of one provider's breaker.
type ProviderStatus struct {
	Provider  string `json:"provider"`
	State     string `json:"state"`     // closed | half-open | open
	Available bool   `json:"available"` // false only when open
}

// ProviderRegistry holds one breaker per configured LLM provider.
type ProviderRegistry struct {
	mu       sync.RWMutex
	breakers map[string]*gobreaker.CircuitBreaker
	order    []string
}

// NewProviderRegistry builds a breaker for each provider name.
// Names must match the allowlist in handlers/telemetry.go.
func NewProviderRegistry(providers []string) *ProviderRegistry {
	r := &ProviderRegistry{
		breakers: make(map[string]*gobreaker.CircuitBreaker, len(providers)),
	}

	for _, name := range providers {
		if name == "" {
			continue
		}
		if _, exists := r.breakers[name]; exists {
			continue
		}
		r.breakers[name] = gobreaker.NewCircuitBreaker(providerSettings(name))
		r.order = append(r.order, name)
	}

	sort.Strings(r.order)
	return r
}

func providerSettings(name string) gobreaker.Settings {
	breakerName := "llm-" + name

	return gobreaker.Settings{
		Name:        breakerName,
		MaxRequests: providerHalfOpenProbes,
		Interval:    providerCountInterval,
		Timeout:     providerOpenTimeout,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= providerMaxFailures
		},
		OnStateChange: func(n string, from, to gobreaker.State) {
			log.Warn().
				Str("breaker", n).
				Str("provider", name).
				Str("from", from.String()).
				Str("to", to.String()).
				Msg("LLM provider circuit breaker state changed")

			observability.CircuitBreakerStateChanges.WithLabelValues(n, to.String()).Inc()

			if to == gobreaker.StateOpen {
				observability.CircuitBreakerOpen.WithLabelValues(n).Set(1)
			} else {
				observability.CircuitBreakerOpen.WithLabelValues(n).Set(0)
			}
		},
	}
}

// Record folds one observed provider outcome into its breaker.
//
// The chat plane performs the actual call, so there is no function for the
// breaker to wrap. Execute is handed a trivial closure that simply returns the
// observed result: that is what advances gobreaker's counts and drives its
// state transitions. Unknown providers are ignored rather than registered on
// the fly, so a malformed telemetry event cannot create breakers.
func (r *ProviderRegistry) Record(provider string, success bool) {
	r.mu.RLock()
	cb, ok := r.breakers[provider]
	r.mu.RUnlock()
	if !ok {
		return
	}

	_, _ = cb.Execute(func() (interface{}, error) {
		if success {
			return nil, nil
		}
		return nil, errProviderFailure
	})
}

// Available reports whether the chat plane should attempt this provider.
// An unknown provider is reported available: the registry must not silently
// remove a provider the chat plane knows about but this process was not told of.
func (r *ProviderRegistry) Available(provider string) bool {
	r.mu.RLock()
	cb, ok := r.breakers[provider]
	r.mu.RUnlock()
	if !ok {
		return true
	}
	return cb.State() != gobreaker.StateOpen
}

// Snapshot returns the state of every registered provider, in stable order.
func (r *ProviderRegistry) Snapshot() []ProviderStatus {
	r.mu.RLock()
	defer r.mu.RUnlock()

	out := make([]ProviderStatus, 0, len(r.order))
	for _, name := range r.order {
		state := r.breakers[name].State()
		out = append(out, ProviderStatus{
			Provider:  name,
			State:     state.String(),
			Available: state != gobreaker.StateOpen,
		})
	}
	return out
}

// AnyAvailable reports whether at least one provider is not open.
// Used by /readyz: a deployment whose every LLM provider has tripped cannot
// serve chat and should be pulled from the load balancer.
func (r *ProviderRegistry) AnyAvailable() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, cb := range r.breakers {
		if cb.State() != gobreaker.StateOpen {
			return true
		}
	}
	return false
}

// Len returns the number of registered providers.
func (r *ProviderRegistry) Len() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.breakers)
}

// errProviderFailure marks an observed failure for gobreaker's counters.
type providerFailure struct{}

func (providerFailure) Error() string { return "llm provider reported a failure" }

var errProviderFailure = providerFailure{}

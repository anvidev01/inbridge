// Package circuit wraps outbound HTTP calls to the Python AI service with a
// sony/gobreaker circuit breaker.
//
// State machine:
//   - Closed  → requests pass through normally.
//   - Open    → requests fail immediately (ErrCircuitOpen) without hitting the AI service.
//   - Half-Open → a limited number of probe requests are allowed through to test recovery.
//
// When the state changes, the Prometheus gauge inbridge_circuit_breaker_open is
// updated so the Grafana dashboard can visualise open circuits.
package circuit

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/MeitY/inbridge-backend/observability"
	"github.com/rs/zerolog/log"
	"github.com/sony/gobreaker"
)

const (
	// cbName identifies this breaker in metrics and logs.
	cbName = "ai-service"

	// maxConsecutiveFailures is how many consecutive failures open the breaker.
	maxConsecutiveFailures = 5

	// openTimeout is how long the breaker stays open before entering half-open.
	openTimeout = 30 * time.Second

	// halfOpenMaxRequests is the number of probe requests allowed in half-open state.
	halfOpenMaxRequests = 2
)

// AIClient wraps the Python AI service HTTP client with a circuit breaker.
type AIClient struct {
	baseURL string
	cb      *gobreaker.CircuitBreaker
	http    *http.Client
}

// ChatRequest is the payload sent to the Python AI /chat endpoint.
type ChatRequest struct {
	Query     string `json:"query"`
	CitizenID string `json:"citizen_id"`
}

// ChatResponse is the response from the Python AI /chat endpoint.
type ChatResponse struct {
	Response string `json:"response"`
}

// NewAIClient constructs an AIClient with a pre-configured circuit breaker.
func NewAIClient(baseURL string) *AIClient {
	settings := gobreaker.Settings{
		Name:        cbName,
		MaxRequests: halfOpenMaxRequests,
		Interval:    60 * time.Second, // Counts reset after 60s in closed state.
		Timeout:     openTimeout,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= maxConsecutiveFailures
		},
		OnStateChange: func(name string, from, to gobreaker.State) {
			log.Warn().
				Str("breaker", name).
				Str("from", from.String()).
				Str("to", to.String()).
				Msg("Circuit breaker state changed")

			// Update Prometheus metrics.
			observability.CircuitBreakerStateChanges.
				WithLabelValues(name, to.String()).
				Inc()

			if to == gobreaker.StateOpen {
				observability.CircuitBreakerOpen.WithLabelValues(name).Set(1)
			} else {
				observability.CircuitBreakerOpen.WithLabelValues(name).Set(0)
			}
		},
	}

	return &AIClient{
		baseURL: baseURL,
		cb:      gobreaker.NewCircuitBreaker(settings),
		http:    &http.Client{Timeout: 30 * time.Second},
	}
}

// Chat sends a query to the Python AI /chat endpoint, protected by the circuit breaker.
// Returns ErrCircuitOpen when the breaker is tripped so callers can surface a fast 503.
func (c *AIClient) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	result, err := c.cb.Execute(func() (interface{}, error) {
		return c.doChat(ctx, req)
	})

	if err != nil {
		if err == gobreaker.ErrOpenState || err == gobreaker.ErrTooManyRequests {
			log.Error().
				Str("breaker", cbName).
				Str("state", c.cb.State().String()).
				Msg("Circuit breaker is open — skipping AI service call")
		}
		return nil, err
	}

	return result.(*ChatResponse), nil
}

// doChat performs the actual HTTP POST to the AI service.
func (c *AIClient) doChat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("circuit/ai: marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("circuit/ai: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("circuit/ai: http do: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		// 5xx responses count as failures for the circuit breaker.
		return nil, fmt.Errorf("circuit/ai: upstream returned %d", resp.StatusCode)
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("circuit/ai: read body: %w", err)
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return nil, fmt.Errorf("circuit/ai: unmarshal response: %w", err)
	}

	return &chatResp, nil
}

// State returns the current circuit breaker state for health checks.
func (c *AIClient) State() gobreaker.State {
	return c.cb.State()
}

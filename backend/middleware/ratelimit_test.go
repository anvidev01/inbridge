package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-redis/redis/v8"
)

// With Redis unreachable the limiter must fail open, not return 500.
func TestRateLimitFailsOpenWhenRedisDown(t *testing.T) {
	rdb := redis.NewClient(&redis.Options{Addr: "127.0.0.1:1", DialTimeout: 200 * time.Millisecond, MaxRetries: -1})
	defer rdb.Close()

	called := false
	h := RateLimitMiddleware(rdb, 20, 5, time.Minute)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil))

	if !called || rec.Code != http.StatusOK {
		t.Fatalf("expected request to pass through (called=%v code=%d)", called, rec.Code)
	}
}

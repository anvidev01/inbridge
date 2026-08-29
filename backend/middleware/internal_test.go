package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestInternalAuth(t *testing.T) {
	const token = "s3cret-token"

	handler := InternalAuth(token)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusAccepted)
	}))

	cases := []struct {
		name     string
		header   string
		setToken bool
		want     int
	}{
		{name: "correct token", header: token, setToken: true, want: http.StatusAccepted},
		{name: "wrong token", header: "nope", setToken: true, want: http.StatusUnauthorized},
		{name: "token prefix only", header: "s3cret", setToken: true, want: http.StatusUnauthorized},
		{name: "missing header", setToken: false, want: http.StatusUnauthorized},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/internal/telemetry/llm", nil)
			if tc.setToken {
				req.Header.Set(InternalTokenHeader, tc.header)
			}
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != tc.want {
				t.Fatalf("want %d, got %d", tc.want, rec.Code)
			}
		})
	}
}

// TestInternalAuthEmptyTokenDenies covers the defensive branch: even if a caller
// mounts the middleware without a configured secret, it must not be open.
func TestInternalAuthEmptyTokenDenies(t *testing.T) {
	handler := InternalAuth("")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler must not be reached with an empty token")
	}))

	req := httptest.NewRequest(http.MethodPost, "/internal/telemetry/llm", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 when no token is configured, got %d", rec.Code)
	}
}

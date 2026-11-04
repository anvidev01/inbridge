package middleware

import (
	"net/http/httptest"
	"testing"
)

func TestClientIP(t *testing.T) {
	cases := []struct {
		name, xff, remote, want string
	}{
		{"remote with port", "", "203.0.113.7:51733", "203.0.113.7"},
		{"remote ipv6 with port", "", "[::1]:51733", "::1"},
		{"xff single", "198.51.100.4", "10.0.0.1:80", "198.51.100.4"},
		{"xff list uses first", "198.51.100.4, 10.1.1.1, 10.2.2.2", "10.0.0.1:80", "198.51.100.4"},
		{"xff garbage falls back", "not-an-ip", "203.0.113.7:99", "203.0.113.7"},
		{"nothing valid", "", "bogus", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/", nil)
			r.RemoteAddr = c.remote
			if c.xff != "" {
				r.Header.Set("X-Forwarded-For", c.xff)
			}
			if got := ClientIP(r); got != c.want {
				t.Fatalf("ClientIP = %q, want %q", got, c.want)
			}
		})
	}
}

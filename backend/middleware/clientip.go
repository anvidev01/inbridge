package middleware

import (
	"net"
	"net/http"
	"strings"
)

// ClientIP returns the caller's bare IP address (no port), or "" if none can be
// determined. It prefers the first X-Forwarded-For entry (the original client
// behind Render's proxy) and falls back to the connection's remote address.
//
// Callers need a clean IP: audit_log.ip_address is a Postgres inet column, which
// rejects "host:port" and comma-separated lists, and the rate limiter must not
// key on the ephemeral source port.
//
// X-Forwarded-For is client-controlled when no trusted proxy overwrites it, so
// the result is suitable for logging and best-effort throttling, not for
// authorization.
func ClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		first := strings.TrimSpace(strings.Split(xff, ",")[0])
		if ip := parseIP(first); ip != "" {
			return ip
		}
	}
	return parseIP(r.RemoteAddr)
}

func parseIP(s string) string {
	if host, _, err := net.SplitHostPort(s); err == nil {
		s = host
	}
	s = strings.Trim(s, "[]")
	if ip := net.ParseIP(s); ip != nil {
		return ip.String()
	}
	return ""
}

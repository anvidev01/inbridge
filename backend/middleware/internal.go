// Package middleware — internal.go guards service-to-service routes that are
// reachable on the same listener as public traffic.
package middleware

import (
	"crypto/subtle"
	"net/http"

	"github.com/rs/zerolog/log"
)

// InternalTokenHeader is the header the chat plane sends its shared secret in.
const InternalTokenHeader = "X-Internal-Token"

// InternalAuth returns middleware that admits only callers presenting the
// configured shared secret.
//
// The comparison is constant-time: a byte-wise `==` on a secret leaks its prefix
// through response timing, which is enough to recover the token one byte at a
// time. Callers must not mount this with an empty token — main.go declines to
// register internal routes at all when INTERNAL_API_TOKEN is unset, so an
// unconfigured deployment exposes no internal surface rather than an open one.
func InternalAuth(token string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if token == "" {
				// Defensive: should be unreachable — routes are not mounted.
				log.Error().Msg("InternalAuth invoked with an empty token — denying")
				http.Error(w, "internal routes disabled", http.StatusNotFound)
				return
			}

			presented := r.Header.Get(InternalTokenHeader)
			if subtle.ConstantTimeCompare([]byte(presented), []byte(token)) != 1 {
				log.Warn().
					Str("path", r.URL.Path).
					Str("remote", r.RemoteAddr).
					Msg("Rejected internal request with bad or missing token")
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

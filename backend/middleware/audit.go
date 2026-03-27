package middleware

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

func AuditMiddleware(db *pgxpool.Pool, action, resource string) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			citizenIDVal := r.Context().Value(CitizenIDKey)
			if citizenIDVal == nil {
				next.ServeHTTP(w, r)
				return
			}

			citizenID := citizenIDVal.(uuid.UUID)
			ip := r.Header.Get("X-Forwarded-For")
			if ip == "" {
				ip = r.RemoteAddr
			}
			userAgent := r.UserAgent()

			query := `
				INSERT INTO audit_log (citizen_id, action, resource, ip_address, user_agent, timestamp_ist)
				VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
			`
			
			_, err := db.Exec(r.Context(), query, citizenID, action, resource, ip, userAgent)
			if err != nil {
				log.Error().Err(err).
					Str("citizen_id", citizenID.String()).
					Str("action", action).
					Msg("Failed to write audit log")
			}

			next.ServeHTTP(w, r)
		})
	}
}

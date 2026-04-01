package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// CheckStatus queries the applications table by ARN and returns the current status.
func CheckStatus(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		arn := chi.URLParam(r, "arn")
		if arn == "" {
			http.Error(w, "arn is required", http.StatusBadRequest)
			return
		}

		var (
			serviceCode string
			status      string
		)

		err := db.QueryRow(r.Context(),
			"SELECT service_code, status FROM applications WHERE arn = $1", arn).
			Scan(&serviceCode, &status)

		if err != nil {
			if err == pgx.ErrNoRows {
				http.Error(w, "application not found for the given ARN", http.StatusNotFound)
				return
			}
			log.Error().Err(err).Str("arn", arn).Msg("Failed to query application status")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"arn":          arn,
			"service_code": serviceCode,
			"status":       status,
		})
	}
}

package handlers

import (
	"encoding/json"
	"net/http"
	"time"
	"unicode/utf8"

	"github.com/MeitY/inbridge-backend/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

const (
	maxSubjectLen     = 200
	maxDescriptionLen = 2000
)

// CreateGrievance inserts a new grievance into the database.
func CreateGrievance(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		citizenIDVal := r.Context().Value(middleware.CitizenIDKey)
		if citizenIDVal == nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		citizenID := citizenIDVal.(uuid.UUID)

		var req struct {
			Subject     string `json:"subject"`
			Description string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		// Input validation
		if req.Subject == "" || req.Description == "" {
			http.Error(w, "subject and description are required", http.StatusBadRequest)
			return
		}
		if utf8.RuneCountInString(req.Subject) > maxSubjectLen {
			http.Error(w, "subject exceeds maximum length", http.StatusBadRequest)
			return
		}
		if utf8.RuneCountInString(req.Description) > maxDescriptionLen {
			http.Error(w, "description exceeds maximum length", http.StatusBadRequest)
			return
		}

		grievanceID := uuid.New()
		now := time.Now()

		_, err := db.Exec(r.Context(),
			`INSERT INTO grievances (id, citizen_id, subject, description, status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			grievanceID, citizenID, req.Subject, req.Description, "REGISTERED", now, now)

		if err != nil {
			log.Error().Err(err).Str("citizen_id", citizenID.String()).Msg("Failed to create grievance")
			http.Error(w, "failed to create grievance", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{
			"grievance_id": grievanceID.String(),
			"status":       "REGISTERED",
		})
	}
}

// GetGrievance fetches a grievance by ID from the database.
func GetGrievance(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		grievanceID, err := uuid.Parse(idStr)
		if err != nil {
			http.Error(w, "invalid grievance ID format", http.StatusBadRequest)
			return
		}

		var (
			id          uuid.UUID
			citizenID   uuid.UUID
			subject     string
			description string
			status      string
			resolution  *string
			createdAt   time.Time
			updatedAt   time.Time
		)

		err = db.QueryRow(r.Context(),
			`SELECT id, citizen_id, subject, description, status, resolution, created_at, updated_at
			FROM grievances WHERE id = $1`, grievanceID).
			Scan(&id, &citizenID, &subject, &description, &status, &resolution, &createdAt, &updatedAt)

		if err != nil {
			if err == pgx.ErrNoRows {
				http.Error(w, "grievance not found", http.StatusNotFound)
				return
			}
			log.Error().Err(err).Str("grievance_id", idStr).Msg("Failed to fetch grievance")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		resp := map[string]interface{}{
			"id":          id.String(),
			"citizen_id":  citizenID.String(),
			"subject":     subject,
			"description": description,
			"status":      status,
			"created_at":  createdAt,
			"updated_at":  updatedAt,
		}
		if resolution != nil {
			resp["resolution"] = *resolution
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

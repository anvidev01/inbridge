package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/MeitY/inbridge-backend/middleware"
	"github.com/MeitY/inbridge-backend/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// GetCitizenProfile returns the profile of the authenticated citizen.
func GetCitizenProfile(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		citizenIDVal := r.Context().Value(middleware.CitizenIDKey)
		if citizenIDVal == nil {
			http.Error(w, "unauthorized: missing citizen context", http.StatusUnauthorized)
			return
		}
		
		citizenID, ok := citizenIDVal.(uuid.UUID)
		if !ok {
			log.Error().Msg("Invalid citizen ID type in context")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		var citizen models.Citizen
		err := db.QueryRow(r.Context(),
			"SELECT id, vid, full_name, email, date_of_birth, gender, state, district, mobile_number, created_at, updated_at FROM citizens WHERE id = $1",
			citizenID).Scan(&citizen.ID, &citizen.VID, &citizen.FullName, &citizen.Email, &citizen.DateOfBirth, &citizen.Gender, &citizen.State, &citizen.District, &citizen.MobileNumber, &citizen.CreatedAt, &citizen.UpdatedAt)

		if err != nil {
			if err == pgx.ErrNoRows {
				http.Error(w, "citizen not found", http.StatusNotFound)
				return
			}
			log.Error().Err(err).Str("citizen_id", citizenID.String()).Msg("Failed to query citizen profile")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(citizen)
	}
}

// UpdateCitizenProfile updates the profile information for the authenticated citizen.
func UpdateCitizenProfile(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		citizenIDVal := r.Context().Value(middleware.CitizenIDKey)
		if citizenIDVal == nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		
		citizenID, ok := citizenIDVal.(uuid.UUID)
		if !ok {
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		var update struct {
			MobileNumber string `json:"mobile_number"`
		}
		if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		// Basic validation for mobile number
		if update.MobileNumber == "" {
			http.Error(w, "mobile_number is required", http.StatusBadRequest)
			return
		}

		_, err := db.Exec(r.Context(),
			"UPDATE citizens SET mobile_number = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
			update.MobileNumber, citizenID)

		if err != nil {
			log.Error().Err(err).Str("citizen_id", citizenID.String()).Msg("Failed to update citizen profile")
			http.Error(w, "failed to update profile", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "success", "message": "profile updated"}`))
	}
}

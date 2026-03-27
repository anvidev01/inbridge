package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/MeitY/inbridge-backend/middleware"
	"github.com/MeitY/inbridge-backend/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func GetCitizenProfile(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		citizenID := r.Context().Value(middleware.CitizenIDKey).(uuid.UUID)

		var citizen models.Citizen
		err := db.QueryRow(r.Context(),
			"SELECT id, vid, full_name, date_of_birth, gender, state, district, mobile_number, created_at, updated_at FROM citizens WHERE id = $1",
			citizenID).Scan(&citizen.ID, &citizen.VID, &citizen.FullName, &citizen.DateOfBirth, &citizen.Gender, &citizen.State, &citizen.District, &citizen.MobileNumber, &citizen.CreatedAt, &citizen.UpdatedAt)

		if err != nil {
			http.Error(w, "citizen not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(citizen)
	}
}

func UpdateCitizenProfile(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		citizenID := r.Context().Value(middleware.CitizenIDKey).(uuid.UUID)

		var update struct {
			MobileNumber string `json:"mobile_number"`
		}
		if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		_, err := db.Exec(r.Context(),
			"UPDATE citizens SET mobile_number = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
			update.MobileNumber, citizenID)

		if err != nil {
			http.Error(w, "failed to update profile", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "success"}`))
	}
}

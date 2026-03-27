package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/MeitY/inbridge-backend/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func CreateGrievance() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_ = r.Context().Value(middleware.CitizenIDKey).(uuid.UUID)

		var req struct {
			Subject     string `json:"subject"`
			Description string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"grievance_id": "GRV-XYZ-123",
			"status":       "REGISTERED",
		})
	}
}

func GetGrievance() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"grievance_id": id,
			"status":       "IN_PROGRESS",
			"resolution":   "",
		})
	}
}

package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/MeitY/inbridge-backend/middleware"
	"github.com/MeitY/inbridge-backend/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// AllowedServiceCodes defines the list of valid services.
var AllowedServiceCodes = map[string]bool{
	"aadhaar":      true,
	"pan":          true,
	"passport":     true,
	"licence":      true,
	"birth":        true,
	"marriage":     true,
	"ration":       true,
	"school":       true,
	"pmkisan":      true,
	"pension":      true,
	"itr":          true,
	"gst":          true,
	"complaint":    true,
	"track-griev": true,
	"escalate":     true,
	"rti":          true,
}

// ListServices returns the catalog of government services.
func ListServices() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// This is a static catalog for now, which is acceptable for reference data.
		services := []map[string]interface{}{
			// Personal
			{"id": "aadhaar", "category": "personal", "icon": "🪪", "label": "Apply for Aadhaar", "description": "Enrol or get a new Aadhaar card", "href": "/apply/aadhaar", "isPopular": true},
			{"id": "pan", "category": "personal", "icon": "💳", "label": "Update PAN", "description": "Correct or update your PAN details", "href": "/apply/pan"},
			{"id": "passport", "category": "personal", "icon": "📘", "label": "Track Passport", "description": "Check passport application status", "href": "/status?type=passport"},
			{"id": "licence", "category": "personal", "icon": "🚗", "label": "Download Licence", "description": "Get your driving licence PDF", "href": "/services/driving-licence"},
			// Family
			{"id": "birth", "category": "family", "icon": "👶", "label": "Birth Certificate", "description": "Apply for a birth certificate", "href": "/apply/birth-certificate"},
			{"id": "marriage", "category": "family", "icon": "💍", "label": "Marriage Registration", "description": "Register your marriage online", "href": "/apply/marriage-registration"},
			{"id": "ration", "category": "family", "icon": "🍚", "label": "Ration Card", "description": "Apply or update ration card", "href": "/apply/ration-card"},
			{"id": "school", "category": "family", "icon": "🏫", "label": "School Admission", "description": "Admission to government schools", "href": "/apply/school-admission", "isNew": true},
			// Financial
			{"id": "pmkisan", "category": "financial", "icon": "🌾", "label": "PM-KISAN Status", "description": "Check your PM-KISAN instalment status", "href": "/services/pm-kisan", "isPopular": true},
			{"id": "pension", "category": "financial", "icon": "🧓", "label": "Check Pension", "description": "View your pension account details", "href": "/services/pension"},
			{"id": "itr", "category": "financial", "icon": "📊", "label": "File ITR", "description": "File your income tax return", "href": "/services/itr"},
			{"id": "gst", "category": "financial", "icon": "🏢", "label": "GST Registration", "description": "Register your business for GST", "href": "/apply/gst-registration"},
			// Grievance
			{"id": "complaint", "category": "grievance", "icon": "📣", "label": "File Complaint", "description": "Register a complaint with authorities", "href": "/apply/complaint"},
			{"id": "track-griev", "category": "grievance", "icon": "🔍", "label": "Track Grievance", "description": "Track your filed grievance", "href": "/status?type=grievance"},
			{"id": "escalate", "category": "grievance", "icon": "⬆️", "label": "Escalate Issue", "description": "Escalate unresolved grievance", "href": "/services/escalate"},
			{"id": "rti", "category": "grievance", "icon": "📜", "label": "RTI Request", "description": "File Right to Information request", "href": "/apply/rti", "isNew": true},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(services)
	}
}

// ApplyForService handles service application submission with validation.
func ApplyForService(db *pgxpool.Pool) http.HandlerFunc {
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

		var req struct {
			ServiceCode string          `json:"service_code"`
			FormData    json.RawMessage `json:"form_data"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		// Validation
		if req.ServiceCode == "" {
			http.Error(w, "service_code is required", http.StatusBadRequest)
			return
		}
		if !AllowedServiceCodes[req.ServiceCode] {
			http.Error(w, "invalid service_code", http.StatusBadRequest)
			return
		}

		appID, err := models.NewApplicationID()
		if err != nil {
			log.Error().Err(err).Msg("Failed to generate application ID")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		
		arn := fmt.Sprintf("ARN-%s-%d", req.ServiceCode, time.Now().Unix()%1000000000)

		_, err = db.Exec(r.Context(),
			"INSERT INTO applications (id, citizen_id, arn, service_code, status, form_data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())",
			appID, citizenID, arn, req.ServiceCode, "SUBMITTED", req.FormData)

		if err != nil {
			log.Error().Err(err).Str("citizen_id", citizenID.String()).Str("service_code", req.ServiceCode).Msg("Application submission failed")
			http.Error(w, "application submission failed", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]string{
			"arn":    arn,
			"status": "SUBMITTED",
		})
	}
}

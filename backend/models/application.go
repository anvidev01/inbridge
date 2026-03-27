package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Application struct {
	ID          uuid.UUID       `json:"id"`
	CitizenID   uuid.UUID       `json:"citizen_id"`
	ARN         string          `json:"arn"`
	ServiceCode string          `json:"service_code"`
	Status      string          `json:"status"`
	FormData    json.RawMessage `json:"form_data"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// NewApplicationID generates a UUID v7 which is sortable and sequential
func NewApplicationID() (uuid.UUID, error) {
	return uuid.NewV7()
}

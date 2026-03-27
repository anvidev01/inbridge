package models

import (
	"time"

	"github.com/google/uuid"
)

type AuditEntry struct {
	ID           uuid.UUID `json:"id"`
	CitizenID    uuid.UUID `json:"citizen_id"`
	Action       string    `json:"action"`
	Resource     string    `json:"resource"`
	IPAddress    string    `json:"ip_address"`
	UserAgent    string    `json:"user_agent"`
	TimestampIST time.Time `json:"timestamp_ist"`
}

package models

import (
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type Citizen struct {
	ID           uuid.UUID `json:"id"`
	VID          string    `json:"vid"`
	FullName     string    `json:"full_name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	DateOfBirth  string    `json:"date_of_birth"`
	Gender       string    `json:"gender"`
	State        string    `json:"state"`
	District     string    `json:"district"`
	MobileNumber string    `json:"mobile_number,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// TokenizeAadhaar computes a basic SHA256 of the Aadhaar to simulate VID tokenization
// In reality, this should call UIDAI API to generate VID and discard the raw number.
func TokenizeAadhaar(rawAadhaar string) string {
	hash := sha256.Sum256([]byte(rawAadhaar))
	return "VID-" + hex.EncodeToString(hash[:10])
}

// HashPassword hashes a plain text password using bcrypt
func (c *Citizen) HashPassword(password string) error {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	c.PasswordHash = string(bytes)
	return nil
}

// CheckPassword compares the hashed password with the plaintext password
func (c *Citizen) CheckPassword(password string) error {
	return bcrypt.CompareHashAndPassword([]byte(c.PasswordHash), []byte(password))
}

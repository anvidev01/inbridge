package handlers

import (
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"time"

	"github.com/MeitY/inbridge-backend/models"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AuthRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Register(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Email       string `json:"email"`
			Password    string `json:"password"`
			FullName    string `json:"full_name"`
			VID         string `json:"vid"`
			DateOfBirth string `json:"date_of_birth"`
			Gender      string `json:"gender"`
			State       string `json:"state"`
			District    string `json:"district"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		// Basic validation
		if req.Email == "" || req.Password == "" || req.FullName == "" {
			http.Error(w, "email, password, and full name are required", http.StatusBadRequest)
			return
		}

		citizen := models.Citizen{
			ID:          uuid.New(),
			VID:         req.VID,
			FullName:    req.FullName,
			Email:       req.Email,
			DateOfBirth: req.DateOfBirth,
			Gender:      req.Gender,
			State:       req.State,
			District:    req.District,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		if err := citizen.HashPassword(req.Password); err != nil {
			http.Error(w, "failed to secure password", http.StatusInternalServerError)
			return
		}

		_, err := db.Exec(r.Context(),
			`INSERT INTO citizens (id, vid, full_name, email, password_hash, date_of_birth, gender, state, district, created_at, updated_at) 
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
			citizen.ID, citizen.VID, citizen.FullName, citizen.Email, citizen.PasswordHash, citizen.DateOfBirth, citizen.Gender, citizen.State, citizen.District, citizen.CreatedAt, citizen.UpdatedAt)

		if err != nil {
			http.Error(w, "failed to register user (email might already exist)", http.StatusConflict)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"message": "registration successful", "citizen_id": citizen.ID.String()})
	}
}

func Login(db *pgxpool.Pool, privateKey *rsa.PrivateKey) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req AuthRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		var citizen models.Citizen
		err := db.QueryRow(r.Context(),
			"SELECT id, password_hash FROM citizens WHERE email = $1", req.Email).Scan(&citizen.ID, &citizen.PasswordHash)

		if err != nil {
			http.Error(w, "invalid email or password", http.StatusUnauthorized)
			return
		}

		if err := citizen.CheckPassword(req.Password); err != nil {
			http.Error(w, "invalid email or password", http.StatusUnauthorized)
			return
		}

		// Generate JWT Token
		token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
			"sub": citizen.ID.String(),
			"exp": time.Now().Add(24 * time.Hour).Unix(),
			"iat": time.Now().Unix(),
		})

		tokenString, err := token.SignedString(privateKey)
		if err != nil {
			http.Error(w, "failed to generate token", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"token": tokenString,
		})
	}
}

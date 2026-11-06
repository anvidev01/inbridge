package handlers

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/MeitY/inbridge-backend/models"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

type AuthRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// normalizeEmail lowercases and validates an address. It returns "" if it is not a
// plain address (display names and angle brackets are rejected).
func normalizeEmail(raw string) string {
	e := strings.ToLower(strings.TrimSpace(raw))
	if e == "" || len(e) > 254 {
		return ""
	}
	addr, err := mail.ParseAddress(e)
	if err != nil || addr.Address != e || !strings.Contains(e[strings.LastIndex(e, "@"):], ".") {
		return ""
	}
	return e
}

// newVID returns a unique pseudonymous citizen identifier. The citizens table
// requires one; the sign-up form collects no real identity document, so it is
// generated rather than invented from user input.
func newVID() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "VID-" + strings.ToUpper(hex.EncodeToString(b)), nil
}

func Register(db *pgxpool.Pool, privateKey *rsa.PrivateKey) http.HandlerFunc {
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
		req.FullName = strings.Join(strings.Fields(req.FullName), " ")
		if req.Email == "" || req.Password == "" || req.FullName == "" {
			http.Error(w, "email, password, and full name are required", http.StatusBadRequest)
			return
		}
		if utf8.RuneCountInString(req.FullName) > 255 {
			http.Error(w, "full name is too long", http.StatusBadRequest)
			return
		}
		req.Email = normalizeEmail(req.Email)
		if req.Email == "" {
			http.Error(w, "please enter a valid email address", http.StatusBadRequest)
			return
		}
		if req.VID == "" {
			vid, err := newVID()
			if err != nil {
				http.Error(w, "internal server error", http.StatusInternalServerError)
				return
			}
			req.VID = vid
		}
		// bcrypt silently/loudly breaks past 72 bytes, so cap there.
		if len(req.Password) < 8 || len(req.Password) > 72 {
			http.Error(w, "password must be between 8 and 72 characters", http.StatusBadRequest)
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
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				http.Error(w, "an account with this email already exists", http.StatusConflict)
				return
			}
			log.Error().Err(err).Msg("Register: insert failed")
			http.Error(w, "could not create the account, please try again", http.StatusInternalServerError)
			return
		}

		// Generate JWT Token for immediate login
		token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
			"sub": citizen.ID.String(),
			"exp": time.Now().Add(24 * time.Hour).Unix(),
			"iat": time.Now().Unix(),
		})

		tokenString, err := token.SignedString(privateKey)
		if err != nil {
			log.Info().Err(err).Msg("failed to sign token during registration")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"message":    "registration successful (please log in manually)",
				"citizen_id": citizen.ID.String(),
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "registration successful",
			"token":   tokenString,
			"citizen": map[string]interface{}{
				"id":        citizen.ID.String(),
				"full_name": citizen.FullName,
				"email":     citizen.Email,
			},
		})
	}
}

func Login(db *pgxpool.Pool, privateKey *rsa.PrivateKey) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req AuthRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		// Sign-up lowercases the address, so match it case-insensitively here.
		req.Email = strings.ToLower(strings.TrimSpace(req.Email))

		var citizen models.Citizen
		err := db.QueryRow(r.Context(),
			"SELECT id, full_name, password_hash FROM citizens WHERE email = $1", req.Email).Scan(&citizen.ID, &citizen.FullName, &citizen.PasswordHash)

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
		// Same shape as registration, so the client can show the user's name at once.
		json.NewEncoder(w).Encode(map[string]interface{}{
			"token": tokenString,
			"citizen": map[string]interface{}{
				"id":        citizen.ID.String(),
				"full_name": citizen.FullName,
				"email":     req.Email,
			},
		})
	}
}

package middleware

import (
	"context"
	"crypto/rsa"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type contextKey string

const (
	CitizenIDKey contextKey = "citizen_id"
)

func AuthMiddleware(publicKey *rsa.PublicKey) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "authorization header missing", http.StatusUnauthorized)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				http.Error(w, "invalid authorization header format", http.StatusUnauthorized)
				return
			}

			tokenString := parts[1]

			token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
				}
				return publicKey, nil
			})

			if err != nil || !token.Valid {
				log.Warn().Err(err).Msg("Invalid JWT token")
				http.Error(w, "invalid token", http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, "invalid token claims", http.StatusUnauthorized)
				return
			}

			citizenIDStr, ok := claims["sub"].(string)
			if !ok {
				http.Error(w, "missing subject claim", http.StatusUnauthorized)
				return
			}

			citizenID, err := uuid.Parse(citizenIDStr)
			if err != nil {
				http.Error(w, "invalid subject claim format", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), CitizenIDKey, citizenID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

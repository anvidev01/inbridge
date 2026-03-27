package middleware

import (
	"net/http"
	"os"

	"github.com/go-chi/cors"
)

func CorsMiddleware() func(http.Handler) http.Handler {
	allowedOrigin := os.Getenv("NEXT_PUBLIC_API_URL")
	if allowedOrigin == "" {
		allowedOrigin = "http://localhost:3000"
	}

	return cors.Handler(cors.Options{
		AllowedOrigins:   []string{allowedOrigin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		AllowCredentials: true,
		MaxAge:           300,
	})
}

package middleware

import (
	"net/http"
	"strings"

	"github.com/go-chi/cors"
)

// CorsMiddleware returns CORS handler configured with the specified allowed origins.
// Origins can be comma-separated for multiple values, e.g. "https://app.example.com,https://admin.example.com"
func CorsMiddleware(allowedOrigins string) func(http.Handler) http.Handler {
	origins := strings.Split(allowedOrigins, ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}

	return cors.Handler(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		AllowCredentials: true,
		MaxAge:           300,
	})
}

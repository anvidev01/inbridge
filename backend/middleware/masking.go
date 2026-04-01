package middleware

import (
	"bytes"
	"net/http"
	"regexp"
	"strconv"
)

// responseRecorder captures the status code and body for post-processing.
type responseRecorder struct {
	http.ResponseWriter
	body       *bytes.Buffer
	statusCode int
	headerSent bool
}

func (rw *responseRecorder) Write(p []byte) (int, error) {
	return rw.body.Write(p)
}

func (rw *responseRecorder) WriteHeader(statusCode int) {
	if rw.headerSent {
		return
	}
	rw.statusCode = statusCode
	rw.headerSent = true
}

func (rw *responseRecorder) Header() http.Header {
	return rw.ResponseWriter.Header()
}

// AadhaarMaskingMiddleware masks 12-digit Aadhaar numbers in response bodies.
func AadhaarMaskingMiddleware(next http.Handler) http.Handler {
	aadhaarRegex := regexp.MustCompile(`\b(\d{4})[-\s]?(\d{4})[-\s]?(\d{4})\b`)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rw := &responseRecorder{
			ResponseWriter: w,
			body:           &bytes.Buffer{},
			statusCode:     http.StatusOK, // Default success
		}

		next.ServeHTTP(rw, r)

		responseBody := rw.body.Bytes()
		maskedBody := aadhaarRegex.ReplaceAll(responseBody, []byte("XXXX-XXXX-XXXX-$3"))

		// Set headers and status once
		w.Header().Set("Content-Length", strconv.Itoa(len(maskedBody)))
		w.WriteHeader(rw.statusCode)
		w.Write(maskedBody)
	})
}

package middleware

import (
	"bytes"
	"net/http"
	"regexp"
	"strconv"
)

type responseRecorder struct {
	http.ResponseWriter
	body       *bytes.Buffer
	statusCode int
}

func (rw *responseRecorder) Write(p []byte) (int, error) {
	return rw.body.Write(p)
}

func (rw *responseRecorder) WriteHeader(statusCode int) {
	rw.statusCode = statusCode
	rw.ResponseWriter.WriteHeader(statusCode)
}

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

		rw.ResponseWriter.Header().Set("Content-Length", strconv.Itoa(len(maskedBody)))
		if rw.statusCode != http.StatusOK {
			rw.ResponseWriter.WriteHeader(rw.statusCode)
		}

		rw.ResponseWriter.Write(maskedBody)
	})
}

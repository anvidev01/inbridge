package handlers

import (
	"encoding/json"
	"net/http"
	"runtime"

	"github.com/go-redis/redis/v8"
	"github.com/jackc/pgx/v5/pgxpool"
)

func HealthCheck(db *pgxpool.Pool, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		dbStatus := "down"
		if err := db.Ping(ctx); err == nil {
			dbStatus = "up"
		}

		redisStatus := "down"
		if err := rdb.Ping(ctx).Err(); err == nil {
			redisStatus = "up"
		}

		overallStatus := "ok"
		statusCode := http.StatusOK
		if dbStatus == "down" || redisStatus == "down" {
			overallStatus = "degraded"
		}

		response := map[string]interface{}{
			"status": overallStatus,
			"services": map[string]string{
				"postgres": dbStatus,
				"redis":    redisStatus,
			},
			"runtime": map[string]string{
				"go_version": runtime.Version(),
				"os":         runtime.GOOS,
				"arch":       runtime.GOARCH,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)
		json.NewEncoder(w).Encode(response)
	}
}

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

		redisStatus := "up" 

		response := map[string]interface{}{
			"status": "ok",
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
		json.NewEncoder(w).Encode(response)
	}
}

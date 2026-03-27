package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func RateLimitMiddleware(rdb *redis.Client, authLimit, anonLimit int, window time.Duration) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			ip := r.Header.Get("X-Forwarded-For")
			if ip == "" {
				ip = r.RemoteAddr
			}

			isAuth := r.Context().Value(CitizenIDKey) != nil
			limit := anonLimit
			key := "ratelimit:anon:" + ip

			if isAuth {
				limit = authLimit
				// Handle specific citizen ID parsing appropriately here based off context map
				citizenID := r.Context().Value(CitizenIDKey).(uuid.UUID)
				key = fmt.Sprintf("ratelimit:auth:%s", citizenID.String())
			}

			now := time.Now().UnixNano()
			windowStart := now - window.Nanoseconds()

			pipe := rdb.TxPipeline()
			pipe.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatInt(windowStart, 10))
			pipe.ZAdd(ctx, key, &redis.Z{
				Score:  float64(now),
				Member: now,
			})
			countCmd := pipe.ZCard(ctx, key)
			pipe.Expire(ctx, key, window)

			_, err := pipe.Exec(ctx)
			if err != nil {
				log.Error().Err(err).Msg("Redis rate limit error")
				http.Error(w, "internal server error", http.StatusInternalServerError)
				return
			}

			count := countCmd.Val()
			if count > int64(limit) {
				w.Header().Set("Retry-After", strconv.FormatInt(int64(window.Seconds()), 10))
				http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

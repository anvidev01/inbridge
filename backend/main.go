package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/MeitY/inbridge-backend/config"
	"github.com/MeitY/inbridge-backend/db"
	"github.com/MeitY/inbridge-backend/handlers"
	"github.com/MeitY/inbridge-backend/middleware"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-redis/redis/v8"
	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	zerolog.TimeFieldFormat = time.RFC3339
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339})

	cfg := config.LoadConfig()

	// ── Parse RSA keys from PEM-encoded env vars ──
	privateKey, err := jwt.ParseRSAPrivateKeyFromPEM([]byte(cfg.JWT_PrivateKey))
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to parse JWT_PRIVATE_KEY (must be PEM-encoded RSA private key)")
	}
	publicKey, err := jwt.ParseRSAPublicKeyFromPEM([]byte(cfg.JWT_PublicKey))
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to parse JWT_PUBLIC_KEY (must be PEM-encoded RSA public key)")
	}

	// ── Database ──
	dbPool, err := db.InitPostgres(context.Background(), cfg.DBURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to postgres")
	}
	defer dbPool.Close()

	// ── Redis ──
	rdb := initRedis(cfg.RedisURL)
	defer rdb.Close()

	// ── Router ──
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.CorsMiddleware(cfg.CORSAllowedOrigins))

	// ── Generic Healthchecks (Railway root) ──
	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	r.Get("/health", func(w http.ResponseWriter, req *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	r.Route("/api/v1", func(r chi.Router) {
		// ── Health (public) ──
		r.Get("/health", handlers.HealthCheck(dbPool, rdb))

		// ── Auth (public, rate-limited) ──
		r.Group(func(r chi.Router) {
			r.Use(middleware.RateLimitMiddleware(rdb, 20, 5, 1*time.Minute))
			r.Post("/auth/register", handlers.Register(dbPool, privateKey))
			r.Post("/auth/login", handlers.Login(dbPool, privateKey))
		})

		// ── Public routes ──
		r.Get("/services", handlers.ListServices())
		r.Get("/status/{arn}", handlers.CheckStatus(dbPool))

		// ── Protected routes (JWT required) ──
		r.Group(func(r chi.Router) {
			r.Use(middleware.AuthMiddleware(publicKey))

			r.Get("/citizen/profile", handlers.GetCitizenProfile(dbPool))
			r.Put("/citizen/profile", handlers.UpdateCitizenProfile(dbPool))

			r.With(
				middleware.AuditMiddleware(dbPool, "APPLY_SERVICE", "services"),
			).Post("/services/apply", handlers.ApplyForService(dbPool))

			r.With(
				middleware.AuditMiddleware(dbPool, "CREATE_GRIEVANCE", "grievances"),
			).Post("/grievance", handlers.CreateGrievance(dbPool))

			r.Get("/grievance/{id}", handlers.GetGrievance(dbPool))
		})
	})

	// ── Server ──
	srv := &http.Server{
		Addr:         "0.0.0.0:" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	serverCtx, serverStopCtx := context.WithCancel(context.Background())

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGHUP, syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT)

	go func() {
		<-sig
		log.Info().Msg("Shutdown signal received")

		shutdownCtx, cancel := context.WithTimeout(serverCtx, 30*time.Second)
		defer cancel()

		go func() {
			<-shutdownCtx.Done()
			if shutdownCtx.Err() == context.DeadlineExceeded {
				log.Fatal().Msg("Graceful shutdown timed out.. forcing exit.")
			}
		}()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Fatal().Err(err).Msg("Server shutdown error")
		}
		serverStopCtx()
	}()

	log.Info().Msgf("Server started on port %s", cfg.Port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal().Err(err).Msg("Server closed unexpectedly")
	}

	<-serverCtx.Done()
	log.Info().Msg("Server stopped gracefully")
}

// initRedis creates a Redis client from a URL like "redis://:password@host:port/db"
func initRedis(redisURL string) *redis.Client {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		// Fallback: treat as host:port
		opts = &redis.Options{Addr: redisURL}
	}

	rdb := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Warn().Err(err).Msg("Redis ping failed on startup — rate limiting may not work")
	} else {
		log.Info().Str("addr", maskRedisAddr(redisURL)).Msg("Redis connected")
	}

	return rdb
}

// maskRedisAddr hides passwords in logged Redis URLs
func maskRedisAddr(url string) string {
	if idx := strings.Index(url, "@"); idx != -1 {
		return "redis://***@" + url[idx+1:]
	}
	return url
}

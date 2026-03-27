package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/MeitY/inbridge-backend/config"
	"github.com/MeitY/inbridge-backend/db"
	"github.com/MeitY/inbridge-backend/handlers"
	"github.com/MeitY/inbridge-backend/middleware"
	
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	zerolog.TimeFieldFormat = time.RFC3339
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339})

	cfg := config.LoadConfig()

	dbPool, err := db.InitPostgres(context.Background(), cfg.DBURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to postgres")
	}
	defer dbPool.Close()

	r := chi.NewRouter()
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)

	// Development Mock Auth Middleware
	mockAuth := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			dummyID := uuid.MustParse("123e4567-e89b-12d3-a456-426614174000")
			ctx := context.WithValue(r.Context(), middleware.CitizenIDKey, dummyID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/services", handlers.ListServices())
		r.Get("/status/{arn}", handlers.CheckStatus())

		r.Group(func(r chi.Router) {
			r.Use(mockAuth)
			r.Post("/services/apply", handlers.ApplyForService(dbPool))
			r.Get("/citizen/profile", handlers.GetCitizenProfile(dbPool))
			r.Put("/citizen/profile", handlers.UpdateCitizenProfile(dbPool))
		})
	})

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
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

		err := srv.Shutdown(shutdownCtx)
		if err != nil {
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

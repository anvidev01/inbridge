package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/sync/errgroup"
)

func CheckStatus() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		arn := chi.URLParam(r, "arn")

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		g, gCtx := errgroup.WithContext(ctx)

		results := make(chan string, 3)

		g.Go(func() error {
			time.Sleep(1 * time.Second)
			select {
			case <-gCtx.Done(): return gCtx.Err()
			default: results <- "PM-KISAN: Received"; return nil
			}
		})

		g.Go(func() error {
			time.Sleep(2 * time.Second)
			select {
			case <-gCtx.Done(): return gCtx.Err()
			default: results <- "PFMS: Pending"; return nil
			}
		})

		g.Go(func() error {
			time.Sleep(1 * time.Second)
			select {
			case <-gCtx.Done(): return gCtx.Err()
			default: results <- "STATE: Approved"; return nil
			}
		})

		_ = g.Wait()
		close(results)

		var statusList []string
		for res := range results {
			statusList = append(statusList, res)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"arn":          arn,
			"api_statuses": statusList,
		})
	}
}

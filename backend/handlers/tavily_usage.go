// Package handlers — tavily_usage.go records Tavily search usage reported by the
// Next.js chat plane and exposes running totals.
//
// The Tavily call happens in src/lib/rag-engine.ts (Next.js), but the database
// and the internal-token boundary live here, so the chat plane reports each call
// to POST /internal/telemetry/tavily. Like the rest of telemetry, ingest never
// fails the caller: a bad or unstorable record is logged and dropped.
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

const (
	maxTavilyBody    = 4 << 10 // one small record
	maxCreditsPerReq = 1000.0  // sanity bound; a single search costs 1-2 credits
	maxLatencyMS     = 10 * 60 * 1000
	tavilyDBTimeout  = 3 * time.Second
)

var allowedSearchDepths = map[string]bool{
	"basic": true, "advanced": true, "fast": true, "ultra-fast": true,
}

// TavilyUsageRecord is one search call.
type TavilyUsageRecord struct {
	Success     bool    `json:"success"`
	Credits     float64 `json:"credits"`
	LatencyMS   int     `json:"latency_ms"`
	SearchDepth string  `json:"search_depth,omitempty"`
	ResultCount int     `json:"result_count"`
	ErrorKind   string  `json:"error_kind,omitempty"`
	RequestID   string  `json:"request_id,omitempty"`
}

// sanitize clamps untrusted values and drops anything outside the allowlists.
func (r *TavilyUsageRecord) sanitize() {
	if r.Credits < 0 || r.Credits > maxCreditsPerReq {
		r.Credits = 0
	}
	if r.LatencyMS < 0 || r.LatencyMS > maxLatencyMS {
		r.LatencyMS = 0
	}
	if r.ResultCount < 0 {
		r.ResultCount = 0
	}
	if !allowedSearchDepths[r.SearchDepth] {
		r.SearchDepth = ""
	}
	if r.Success || !allowedErrorKinds[r.ErrorKind] {
		r.ErrorKind = ""
	}
	if len(r.RequestID) > 100 {
		r.RequestID = r.RequestID[:100]
	}
}

// TavilyUsageIngest returns the POST /internal/telemetry/tavily handler.
func TavilyUsageIngest(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()

		var rec TavilyUsageRecord
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxTavilyBody)).Decode(&rec); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "malformed usage record"})
			return
		}
		rec.sanitize()

		ctx, cancel := context.WithTimeout(r.Context(), tavilyDBTimeout)
		defer cancel()
		_, err := db.Exec(ctx, `
			INSERT INTO tavily_usage (success, credits, latency_ms, search_depth, result_count, error_kind, request_id)
			VALUES ($1, $2, $3, NULLIF($4,''), $5, NULLIF($6,''), NULLIF($7,''))`,
			rec.Success, rec.Credits, rec.LatencyMS, rec.SearchDepth, rec.ResultCount, rec.ErrorKind, rec.RequestID)
		if err != nil {
			// Still 202: usage tracking must never become a failure for the caller.
			log.Warn().Err(err).Msg("Tavily usage: insert failed")
			writeJSON(w, http.StatusAccepted, map[string]bool{"stored": false})
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]bool{"stored": true})
	}
}

// TavilyUsageTotals returns the GET /internal/usage/tavily handler: lifetime and
// last-24h totals of calls, credits, failures and average latency.
func TavilyUsageTotals(db *pgxpool.Pool) http.HandlerFunc {
	type totals struct {
		Calls        int64   `json:"calls"`
		Failures     int64   `json:"failures"`
		Credits      float64 `json:"credits"`
		AvgLatencyMS float64 `json:"avg_latency_ms"`
	}
	query := func(ctx context.Context, db *pgxpool.Pool, since time.Time) (totals, error) {
		var t totals
		err := db.QueryRow(ctx, `
			SELECT COUNT(*), COUNT(*) FILTER (WHERE NOT success),
			       COALESCE(SUM(credits),0)::float8, COALESCE(AVG(latency_ms),0)::float8
			FROM tavily_usage WHERE created_at >= $1`, since).
			Scan(&t.Calls, &t.Failures, &t.Credits, &t.AvgLatencyMS)
		return t, err
	}
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), tavilyDBTimeout)
		defer cancel()
		all, err1 := query(ctx, db, time.Unix(0, 0))
		day, err2 := query(ctx, db, time.Now().Add(-24*time.Hour))
		if err1 != nil || err2 != nil {
			log.Warn().Err(err1).Err(err2).Msg("Tavily usage: totals query failed")
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "usage store unavailable"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]totals{"all_time": all, "last_24h": day})
	}
}

// Package handlers — threads.go stores a signed-in citizen's chat history so a
// conversation can be continued on any device.
//
// The browser is the source of truth while chatting (src/lib/history.ts); these
// endpoints mirror it. Threads are stored as the browser holds them, with the
// messages as opaque JSON, so cited answers render identically after a reload.
// Everything here is scoped to the JWT's citizen: ids alone never grant access.
package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/MeitY/inbridge-backend/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

const (
	maxThreadsPerCitizen = 50      // matches MAX_THREADS in src/lib/history.ts
	maxThreadBody        = 1 << 20 // 1 MiB per thread
	maxThreadMessages    = 400
	maxThreadTitle       = 200
)

// threadIDPattern admits the browser's uuid and its `t_<time>_<rand>` fallback.
var threadIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// threadPayload is a thread as the browser sends and receives it.
type threadPayload struct {
	ID        string          `json:"id,omitempty"`
	Title     string          `json:"title"`
	CreatedAt int64           `json:"createdAt"`
	UpdatedAt int64           `json:"updatedAt"`
	Messages  json.RawMessage `json:"messages"`
}

// validate checks and normalises an incoming thread. It returns a message safe to
// show the caller, or "" if the thread is acceptable.
func (t *threadPayload) validate() string {
	t.Title = strings.Join(strings.Fields(t.Title), " ")
	if t.Title == "" {
		return "title is required"
	}
	if utf8.RuneCountInString(t.Title) > maxThreadTitle {
		r := []rune(t.Title)
		t.Title = string(r[:maxThreadTitle])
	}
	if t.CreatedAt <= 0 || t.UpdatedAt <= 0 {
		return "createdAt and updatedAt must be epoch milliseconds"
	}
	var msgs []json.RawMessage
	if err := json.Unmarshal(t.Messages, &msgs); err != nil {
		return "messages must be a JSON array"
	}
	if len(msgs) == 0 {
		return "a thread needs at least one message"
	}
	if len(msgs) > maxThreadMessages {
		return "too many messages in one thread"
	}
	return ""
}

func citizenFromContext(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, ok := r.Context().Value(middleware.CitizenIDKey).(uuid.UUID)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return uuid.Nil, false
	}
	return id, true
}

// ListThreads returns GET /chat/threads: the citizen's threads, newest first.
func ListThreads(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		citizenID, ok := citizenFromContext(w, r)
		if !ok {
			return
		}
		rows, err := db.Query(r.Context(), `
			SELECT id, title, created_at, updated_at, messages
			FROM chat_threads WHERE citizen_id = $1
			ORDER BY updated_at DESC LIMIT $2`, citizenID, maxThreadsPerCitizen)
		if err != nil {
			log.Error().Err(err).Msg("Threads: list failed")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		out := make([]threadPayload, 0)
		for rows.Next() {
			var t threadPayload
			if err := rows.Scan(&t.ID, &t.Title, &t.CreatedAt, &t.UpdatedAt, &t.Messages); err != nil {
				log.Error().Err(err).Msg("Threads: scan failed")
				http.Error(w, "internal server error", http.StatusInternalServerError)
				return
			}
			out = append(out, t)
		}
		if err := rows.Err(); err != nil {
			log.Error().Err(err).Msg("Threads: iterate failed")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}
}

// PutThread returns PUT /chat/threads/{id}: create or update one thread.
//
// An update never replaces a newer copy: a stale tab or a retried request cannot
// roll a conversation back. Equal timestamps are accepted so a rename (which does
// not bump updatedAt in the browser) still lands.
func PutThread(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		citizenID, ok := citizenFromContext(w, r)
		if !ok {
			return
		}
		id := chi.URLParam(r, "id")
		if !threadIDPattern.MatchString(id) {
			http.Error(w, "invalid thread id", http.StatusBadRequest)
			return
		}

		var t threadPayload
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxThreadBody))
		if err := dec.Decode(&t); err != nil {
			var tooBig *http.MaxBytesError
			if errors.As(err, &tooBig) {
				http.Error(w, "thread is too large", http.StatusRequestEntityTooLarge)
				return
			}
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if msg := t.validate(); msg != "" {
			http.Error(w, msg, http.StatusBadRequest)
			return
		}
		// Compact so formatting differences never defeat storage or comparison.
		var compact bytes.Buffer
		if err := json.Compact(&compact, t.Messages); err != nil {
			http.Error(w, "messages must be valid JSON", http.StatusBadRequest)
			return
		}

		tx, err := db.Begin(r.Context())
		if err != nil {
			log.Error().Err(err).Msg("Threads: begin failed")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context()) //nolint:errcheck

		_, err = tx.Exec(r.Context(), `
			INSERT INTO chat_threads (citizen_id, id, title, created_at, updated_at, messages)
			VALUES ($1, $2, $3, $4, $5, $6::jsonb)
			ON CONFLICT (citizen_id, id) DO UPDATE
			   SET title = EXCLUDED.title, updated_at = EXCLUDED.updated_at, messages = EXCLUDED.messages
			 WHERE chat_threads.updated_at <= EXCLUDED.updated_at`,
			citizenID, id, t.Title, t.CreatedAt, t.UpdatedAt, compact.String())
		if err != nil {
			log.Error().Err(err).Msg("Threads: upsert failed")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		// Keep only the newest N, as the browser does.
		if _, err = tx.Exec(r.Context(), `
			DELETE FROM chat_threads WHERE citizen_id = $1 AND id NOT IN (
				SELECT id FROM chat_threads WHERE citizen_id = $1 ORDER BY updated_at DESC LIMIT $2)`,
			citizenID, maxThreadsPerCitizen); err != nil {
			log.Error().Err(err).Msg("Threads: prune failed")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		if err = tx.Commit(r.Context()); err != nil {
			log.Error().Err(err).Msg("Threads: commit failed")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// DeleteThread returns DELETE /chat/threads/{id}. Deleting an absent thread is
// not an error: the browser may retry, and the end state is what it asked for.
func DeleteThread(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		citizenID, ok := citizenFromContext(w, r)
		if !ok {
			return
		}
		id := chi.URLParam(r, "id")
		if !threadIDPattern.MatchString(id) {
			http.Error(w, "invalid thread id", http.StatusBadRequest)
			return
		}
		if _, err := db.Exec(r.Context(),
			`DELETE FROM chat_threads WHERE citizen_id = $1 AND id = $2`, citizenID, id); err != nil && !errors.Is(err, pgx.ErrNoRows) {
			log.Error().Err(err).Msg("Threads: delete failed")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// ClearThreads returns DELETE /chat/threads: remove every thread of the citizen.
func ClearThreads(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		citizenID, ok := citizenFromContext(w, r)
		if !ok {
			return
		}
		if _, err := db.Exec(r.Context(), `DELETE FROM chat_threads WHERE citizen_id = $1`, citizenID); err != nil {
			log.Error().Err(err).Msg("Threads: clear failed")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

package handlers

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestThreadIDPattern(t *testing.T) {
	good := []string{"3f1c2e8a-9b7d-4c1e-8f00-1a2b3c4d5e6f", "t_lx9k2_ab12cd34", "a"}
	bad := []string{"", "../etc/passwd", "a b", "x;DROP", strings.Repeat("a", 65), "é"}
	for _, id := range good {
		if !threadIDPattern.MatchString(id) {
			t.Errorf("id %q should be accepted", id)
		}
	}
	for _, id := range bad {
		if threadIDPattern.MatchString(id) {
			t.Errorf("id %q should be rejected", id)
		}
	}
}

func TestThreadValidate(t *testing.T) {
	msgs := json.RawMessage(`[{"id":"m1","role":"user","parts":[{"type":"text","text":"hi"}]}]`)
	cases := []struct {
		name    string
		t       threadPayload
		wantErr bool
	}{
		{"valid", threadPayload{Title: "  PM  Kisan ", CreatedAt: 1, UpdatedAt: 2, Messages: msgs}, false},
		{"blank title", threadPayload{Title: "   ", CreatedAt: 1, UpdatedAt: 2, Messages: msgs}, true},
		{"bad times", threadPayload{Title: "x", CreatedAt: 0, UpdatedAt: 2, Messages: msgs}, true},
		{"messages not array", threadPayload{Title: "x", CreatedAt: 1, UpdatedAt: 2, Messages: json.RawMessage(`{"a":1}`)}, true},
		{"empty messages", threadPayload{Title: "x", CreatedAt: 1, UpdatedAt: 2, Messages: json.RawMessage(`[]`)}, true},
		{"missing messages", threadPayload{Title: "x", CreatedAt: 1, UpdatedAt: 2}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := c.t.validate()
			if (got != "") != c.wantErr {
				t.Fatalf("validate() = %q, wantErr=%v", got, c.wantErr)
			}
		})
	}

	v := threadPayload{Title: "  PM   Kisan ", CreatedAt: 1, UpdatedAt: 2, Messages: msgs}
	v.validate()
	if v.Title != "PM Kisan" {
		t.Fatalf("title not normalised: %q", v.Title)
	}
	long := threadPayload{Title: strings.Repeat("é", 500), CreatedAt: 1, UpdatedAt: 2, Messages: msgs}
	long.validate()
	if n := len([]rune(long.Title)); n != maxThreadTitle {
		t.Fatalf("title not truncated by runes: %d", n)
	}
}

func TestNormalizeEmail(t *testing.T) {
	cases := map[string]string{
		"  Test.User@Example.COM ": "test.user@example.com",
		"a@b.in":                   "a@b.in",
		"":                         "",
		"no-at-sign":               "",
		"a@b":                      "",
		"Name <a@b.in>":            "",
		"a@b.in, c@d.in":           "",
	}
	for in, want := range cases {
		if got := normalizeEmail(in); got != want {
			t.Errorf("normalizeEmail(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNewVIDUnique(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 1000; i++ {
		v, err := newVID()
		if err != nil || !strings.HasPrefix(v, "VID-") || len(v) != 20 {
			t.Fatalf("bad vid %q err=%v", v, err)
		}
		if seen[v] {
			t.Fatalf("duplicate vid %q", v)
		}
		seen[v] = true
	}
}

package circuit

import (
	"sync"
	"testing"
)

func TestProviderRegistryTripsAfterConsecutiveFailures(t *testing.T) {
	reg := NewProviderRegistry([]string{"anthropic", "gemini", "groq"})

	for i := 0; i < providerMaxFailures-1; i++ {
		reg.Record("anthropic", false)
		if !reg.Available("anthropic") {
			t.Fatalf("breaker opened early after %d failures", i+1)
		}
	}

	reg.Record("anthropic", false)
	if reg.Available("anthropic") {
		t.Fatalf("breaker should be open after %d consecutive failures", providerMaxFailures)
	}
}

func TestProviderRegistryIsolatesProviders(t *testing.T) {
	reg := NewProviderRegistry([]string{"anthropic", "gemini", "groq"})

	for i := 0; i < providerMaxFailures; i++ {
		reg.Record("anthropic", false)
	}

	if reg.Available("anthropic") {
		t.Fatal("anthropic should be open")
	}
	if !reg.Available("gemini") || !reg.Available("groq") {
		t.Fatal("one provider's outage must not open the others")
	}
}

func TestProviderRegistryAnyAvailable(t *testing.T) {
	reg := NewProviderRegistry([]string{"anthropic", "groq"})

	if !reg.AnyAvailable() {
		t.Fatal("a fresh registry should report availability")
	}

	for _, p := range []string{"anthropic", "groq"} {
		for i := 0; i < providerMaxFailures; i++ {
			reg.Record(p, false)
		}
	}

	if reg.AnyAvailable() {
		t.Fatal("registry should report no availability once every breaker is open")
	}
}

// An unknown provider must be reported available rather than skipped: this
// process may simply not have been told about a provider the chat plane knows.
func TestProviderRegistryUnknownProviderIsAvailable(t *testing.T) {
	reg := NewProviderRegistry([]string{"anthropic"})

	if !reg.Available("some-new-provider") {
		t.Fatal("unknown providers must fail open")
	}

	// Recording against an unknown provider must not register a breaker.
	reg.Record("some-new-provider", false)
	if reg.Len() != 1 {
		t.Fatalf("registry grew to %d from an unknown provider", reg.Len())
	}
}

func TestProviderRegistryDeduplicatesAndSortsSnapshot(t *testing.T) {
	reg := NewProviderRegistry([]string{"groq", "anthropic", "groq", ""})

	if reg.Len() != 2 {
		t.Fatalf("expected 2 breakers after dedup/blank removal, got %d", reg.Len())
	}

	snap := reg.Snapshot()
	if len(snap) != 2 || snap[0].Provider != "anthropic" || snap[1].Provider != "groq" {
		t.Fatalf("snapshot should be stably sorted, got %+v", snap)
	}
	for _, p := range snap {
		if !p.Available || p.State != "closed" {
			t.Fatalf("fresh breaker should be closed and available, got %+v", p)
		}
	}
}

// The registry is read by /readyz and the health endpoint while telemetry writes
// to it concurrently; run under -race to catch a missing lock.
func TestProviderRegistryConcurrentAccess(t *testing.T) {
	reg := NewProviderRegistry([]string{"anthropic", "gemini", "groq"})

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(3)
		go func(i int) { defer wg.Done(); reg.Record("anthropic", i%2 == 0) }(i)
		go func() { defer wg.Done(); _ = reg.Snapshot() }()
		go func() { defer wg.Done(); _ = reg.AnyAvailable() }()
	}
	wg.Wait()
}

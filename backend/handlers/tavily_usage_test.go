package handlers

import "testing"

func TestTavilyUsageSanitize(t *testing.T) {
	r := TavilyUsageRecord{Success: true, Credits: -5, LatencyMS: -1, ResultCount: -2,
		SearchDepth: "evil", ErrorKind: "api_error"}
	r.sanitize()
	if r.Credits != 0 || r.LatencyMS != 0 || r.ResultCount != 0 || r.SearchDepth != "" || r.ErrorKind != "" {
		t.Fatalf("not sanitized: %+v", r)
	}

	f := TavilyUsageRecord{Success: false, Credits: 2, LatencyMS: 900, SearchDepth: "advanced", ErrorKind: "timeout"}
	f.sanitize()
	if f.Credits != 2 || f.LatencyMS != 900 || f.SearchDepth != "advanced" || f.ErrorKind != "timeout" {
		t.Fatalf("valid record altered: %+v", f)
	}
}

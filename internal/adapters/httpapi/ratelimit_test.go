package httpapi

import (
	"testing"
	"time"
)

func TestMemoryRateLimiter(t *testing.T) {
	limiter := NewMemoryRateLimiter(time.Minute, 2)
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	if !limiter.Allow("k", now) || !limiter.Allow("k", now.Add(time.Second)) {
		t.Fatal("expected first two requests to be allowed")
	}
	if limiter.Allow("k", now.Add(2*time.Second)) {
		t.Fatal("expected third request in window to be denied")
	}
	if !limiter.Allow("k", now.Add(2*time.Minute)) {
		t.Fatal("expected request after window to be allowed")
	}
}

package httpapi

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type MemoryRateLimiter struct {
	mu      sync.Mutex
	window  time.Duration
	maxHits int
	hits    map[string][]time.Time
}

func NewMemoryRateLimiter(window time.Duration, maxHits int) *MemoryRateLimiter {
	return &MemoryRateLimiter{window: window, maxHits: maxHits, hits: map[string][]time.Time{}}
}

func (l *MemoryRateLimiter) Allow(key string, now time.Time) bool {
	if l == nil || l.maxHits <= 0 || l.window <= 0 {
		return true
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	cutoff := now.Add(-l.window)
	kept := l.hits[key][:0]
	for _, hit := range l.hits[key] {
		if hit.After(cutoff) {
			kept = append(kept, hit)
		}
	}
	if len(kept) >= l.maxHits {
		l.hits[key] = kept
		return false
	}
	l.hits[key] = append(kept, now)
	return true
}

func clientIP(r *http.Request) string {
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwarded != "" {
		ip, _, _ := strings.Cut(forwarded, ",")
		return strings.TrimSpace(ip)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

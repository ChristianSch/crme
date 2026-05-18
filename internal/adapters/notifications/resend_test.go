package notifications

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestResendMagicLinkSender(t *testing.T) {
	var gotAuth string
	var gotPayload map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		if err := json.NewDecoder(r.Body).Decode(&gotPayload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		w.WriteHeader(http.StatusAccepted)
	}))
	defer server.Close()

	sender := ResendMagicLinkSender{APIKey: "test-key", Domain: "example.com", Endpoint: server.URL, HTTPClient: server.Client()}
	if err := sender.SendMagicLink(context.Background(), "ada@example.com", "https://app.example.com/auth/verify?token=abc"); err != nil {
		t.Fatalf("send magic link: %v", err)
	}
	if gotAuth != "Bearer test-key" {
		t.Fatalf("expected auth header, got %q", gotAuth)
	}
	if gotPayload["from"] != "CRME <login@example.com>" {
		t.Fatalf("unexpected from: %#v", gotPayload["from"])
	}
	to, ok := gotPayload["to"].([]any)
	if !ok || len(to) != 1 || to[0] != "ada@example.com" {
		t.Fatalf("unexpected to: %#v", gotPayload["to"])
	}
	if gotPayload["subject"] != "Sign in to CRME" {
		t.Fatalf("unexpected subject: %#v", gotPayload["subject"])
	}
}

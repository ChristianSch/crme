package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"strings"
	"time"
)

const resendDefaultEndpoint = "https://api.resend.com/emails"

type ResendMagicLinkSender struct {
	APIKey     string
	Domain     string
	HTTPClient *http.Client
	Endpoint   string
}

func (s ResendMagicLinkSender) SendMagicLink(ctx context.Context, email, magicURL string) error {
	apiKey := strings.TrimSpace(s.APIKey)
	domain := strings.TrimSpace(s.Domain)
	if apiKey == "" {
		return fmt.Errorf("RESEND_API_KEY is required")
	}
	if domain == "" {
		return fmt.Errorf("RESEND_DOMAIN is required")
	}
	client := s.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	endpoint := strings.TrimSpace(s.Endpoint)
	if endpoint == "" {
		endpoint = resendDefaultEndpoint
	}
	payload := map[string]any{
		"from":    "CRME <login@" + domain + ">",
		"to":      []string{email},
		"subject": "Sign in to CRME",
		"text":    "Sign in to CRME:\n\n" + magicURL + "\n\nIf you did not request this link, you can ignore this email.",
		"html":    magicLinkHTML(magicURL),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("resend send magic link: status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	return nil
}

func magicLinkHTML(magicURL string) string {
	escapedURL := template.HTMLEscapeString(magicURL)
	return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.5;color:#111827"><p>Sign in to CRME:</p><p><a href="` + escapedURL + `" style="display:inline-block;border-radius:8px;background:#111827;color:#fff;padding:10px 14px;text-decoration:none">Sign in</a></p><p>If the button does not work, copy and paste this link:</p><p><a href="` + escapedURL + `">` + escapedURL + `</a></p><p>If you did not request this link, you can ignore this email.</p></body></html>`
}

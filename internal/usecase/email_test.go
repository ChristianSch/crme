package usecase

import (
	"context"
	"errors"
	"testing"
	"unicode/utf8"

	"crme/internal/domain"
)

func TestEmailTextSanitizationKeepsValidUTF8(t *testing.T) {
	invalid := "hello \xe2\x80 world"
	truncated := truncateText(invalid, 8)
	if !utf8.ValidString(truncated) {
		t.Fatalf("truncated text is invalid utf8: %q", truncated)
	}
	msg := sanitizeEmailMessage(domain.EmailMessage{Subject: invalid, BodyText: invalid, ToEmails: []string{invalid}})
	if !utf8.ValidString(msg.Subject) || !utf8.ValidString(msg.BodyText) || !utf8.ValidString(msg.ToEmails[0]) {
		t.Fatalf("email message was not sanitized: %#v", msg)
	}
}

func TestCreateEmailAccountValidation(t *testing.T) {
	svc := EmailService{}
	if _, err := svc.CreateAccount(context.Background(), domain.EmailAccount{Email: "bad", IMAPHost: "imap.example.com"}); !errors.Is(err, ErrValidation) {
		t.Fatalf("expected email validation error, got %v", err)
	}
	if _, err := svc.CreateAccount(context.Background(), domain.EmailAccount{Email: "me@example.com"}); !errors.Is(err, ErrValidation) {
		t.Fatalf("expected IMAP host validation error, got %v", err)
	}
}

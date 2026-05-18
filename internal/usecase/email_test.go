package usecase

import (
	"context"
	"errors"
	"testing"

	"crme/internal/domain"
)

func TestCreateEmailAccountValidation(t *testing.T) {
	svc := EmailService{}
	if _, err := svc.CreateAccount(context.Background(), domain.EmailAccount{Email: "bad", IMAPHost: "imap.example.com"}); !errors.Is(err, ErrValidation) {
		t.Fatalf("expected email validation error, got %v", err)
	}
	if _, err := svc.CreateAccount(context.Background(), domain.EmailAccount{Email: "me@example.com"}); !errors.Is(err, ErrValidation) {
		t.Fatalf("expected IMAP host validation error, got %v", err)
	}
}

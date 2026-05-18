package httpapi

import (
	"testing"
	"time"

	"crme/internal/domain"
)

func TestPersonPatchInputApplyPreservesOmittedAndClearsPresentEmpty(t *testing.T) {
	empty := ""
	patch := personPatchInput{Title: &empty}
	out := patch.apply(domain.Person{FirstName: "Ada", Title: "Engineer", Email: "ada@example.com"})
	if out.FirstName != "Ada" || out.Email != "ada@example.com" {
		t.Fatalf("expected omitted fields preserved, got %+v", out)
	}
	if out.Title != "" {
		t.Fatalf("expected title cleared, got %q", out.Title)
	}
}

func TestCompanyPatchInputApplyPreservesOmittedAndClearsPresentEmpty(t *testing.T) {
	empty := ""
	patch := companyPatchInput{Domain: &empty}
	out := patch.apply(domain.Company{Name: "Acme", Domain: "acme.com"})
	if out.Name != "Acme" {
		t.Fatalf("expected name preserved, got %+v", out)
	}
	if out.Domain != "" {
		t.Fatalf("expected domain cleared, got %q", out.Domain)
	}
}

func TestDealPatchInputApplyPreservesOmittedAndClearsPresentEmpty(t *testing.T) {
	empty := ""
	patch := dealPatchInput{Stage: &empty}
	out := patch.apply(domain.Deal{Name: "Big Deal", Stage: "new", ValueCents: 100})
	if out.Name != "Big Deal" || out.ValueCents != 100 {
		t.Fatalf("expected omitted fields preserved, got %+v", out)
	}
	if out.Stage != "" {
		t.Fatalf("expected stage cleared, got %q", out.Stage)
	}
}

func TestTodoPatchInputApplyPreservesOmittedAndUpdatesPresent(t *testing.T) {
	title := ""
	due := time.Date(2026, 1, 2, 15, 0, 0, 0, time.UTC)
	patch := todoPatchInput{Title: &title, DueAt: &due}
	out := patch.apply(domain.Todo{Title: "Call Ada", Body: "Discuss", Status: domain.TodoOpen})
	if out.Body != "Discuss" || out.Status != domain.TodoOpen {
		t.Fatalf("expected omitted fields preserved, got %+v", out)
	}
	if out.Title != "" {
		t.Fatalf("expected title cleared, got %q", out.Title)
	}
	if out.DueAt == nil || !out.DueAt.Equal(due) {
		t.Fatalf("expected due date updated, got %+v", out.DueAt)
	}
}

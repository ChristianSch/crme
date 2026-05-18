package usecase

import (
	"context"
	"testing"
	"time"
)

type housekeepingStoreFake struct {
	now             time.Time
	retention       time.Duration
	assistantBefore time.Time
}

func (s *housekeepingStoreFake) CleanupAuthArtifacts(ctx context.Context, now time.Time, revokedSessionRetention time.Duration) (HousekeepingReport, error) {
	s.now = now
	s.retention = revokedSessionRetention
	return HousekeepingReport{DeletedMagicLinks: 1, DeletedSessions: 2}, nil
}

func (s *housekeepingStoreFake) CleanupAssistantConversations(ctx context.Context, before time.Time) (int64, error) {
	s.assistantBefore = before
	return 3, nil
}

func TestHousekeepingRunUsesDefaultRetention(t *testing.T) {
	store := &housekeepingStoreFake{}
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	svc := HousekeepingService{Store: store, Now: func() time.Time { return now }}
	report, err := svc.Run(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if report.DeletedMagicLinks != 1 || report.DeletedSessions != 2 || report.DeletedAssistantConversations != 3 {
		t.Fatalf("unexpected report: %+v", report)
	}
	if !store.now.Equal(now) {
		t.Fatalf("expected now %s, got %s", now, store.now)
	}
	if store.retention != 30*24*time.Hour {
		t.Fatalf("expected default retention, got %s", store.retention)
	}
}

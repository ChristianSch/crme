package usecase

import (
	"context"
	"time"

	"crme/internal/authctx"
)

type HousekeepingStore interface {
	CleanupAuthArtifacts(ctx context.Context, now time.Time, revokedSessionRetention time.Duration) (HousekeepingReport, error)
	CleanupAssistantConversations(ctx context.Context, before time.Time) (int64, error)
}

type HousekeepingService struct {
	Store                          HousekeepingStore
	RevokedSessionRetention        time.Duration
	AssistantConversationRetention time.Duration
	Now                            func() time.Time
}

type HousekeepingReport struct {
	DeletedMagicLinks             int64 `json:"deleted_magic_links"`
	DeletedSessions               int64 `json:"deleted_sessions"`
	DeletedAssistantConversations int64 `json:"deleted_assistant_conversations"`
}

func (s HousekeepingService) Run(ctx context.Context) (HousekeepingReport, error) {
	retention := s.RevokedSessionRetention
	if retention <= 0 {
		retention = 30 * 24 * time.Hour
	}
	now := s.now()
	report, err := s.Store.CleanupAuthArtifacts(authctx.WithAuthAccess(ctx), now, retention)
	if err != nil {
		return report, err
	}
	assistantRetention := s.AssistantConversationRetention
	if assistantRetention <= 0 {
		assistantRetention = 14 * 24 * time.Hour
	}
	report.DeletedAssistantConversations, err = s.Store.CleanupAssistantConversations(authctx.WithSystemAccess(ctx), now.Add(-assistantRetention))
	return report, err
}

func (s HousekeepingService) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now().UTC()
}

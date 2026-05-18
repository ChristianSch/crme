package usecase

import (
	"context"
	"log/slog"

	"crme/internal/domain"
	"crme/internal/ports"
)

type AuditService struct {
	Store ports.AuditLogStore
}

func (s AuditService) ListAuditLogs(ctx context.Context, actorRole string, organizationID domain.ID, limit, offset int) ([]domain.AuditLog, error) {
	if s.Store == nil {
		return nil, ErrForbidden
	}
	if organizationID == "" {
		return nil, ErrValidation
	}
	if actorRole != "owner" && actorRole != "admin" {
		return nil, ErrForbidden
	}
	return s.Store.ListAuditLogs(ctx, organizationID, saneLimit(limit), saneOffset(offset))
}

func (s AuthService) recordAudit(ctx context.Context, log domain.AuditLog) {
	if s.Audit == nil {
		return
	}
	if _, err := s.Audit.CreateAuditLog(ctx, log); err != nil {
		slog.WarnContext(ctx, "create audit log", "action", log.Action, "error", err)
	}
}

func recordAudit(ctx context.Context, store ports.AuditLogStore, log domain.AuditLog) {
	if store == nil {
		return
	}
	if _, err := store.CreateAuditLog(ctx, log); err != nil {
		slog.WarnContext(ctx, "create audit log", "action", log.Action, "error", err)
	}
}

package usecase

import (
	"context"
	"fmt"

	"crme/internal/domain"
	"crme/internal/ports"
)

type AdminService struct {
	Store ports.AdminStore
}

func (s AdminService) Stats(ctx context.Context, actorRole string, organizationID domain.ID) (domain.AdminStats, error) {
	if s.Store == nil {
		return domain.AdminStats{}, ErrForbidden
	}
	if actorRole != "owner" && actorRole != "admin" {
		return domain.AdminStats{}, ErrForbidden
	}
	if organizationID == "" {
		return domain.AdminStats{}, fmt.Errorf("%w: organization_id is required", ErrValidation)
	}
	return s.Store.AdminStats(ctx, organizationID)
}

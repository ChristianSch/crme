package authctx

import (
	"context"

	"crme/internal/domain"
)

type Access struct {
	UserID         domain.ID
	UserEmail      string
	OrganizationID domain.ID
	Role           string
	system         bool
	authenticator  bool
}

type key struct{}

func WithAccess(ctx context.Context, access Access) context.Context {
	return context.WithValue(ctx, key{}, access)
}

func WithSystemAccess(ctx context.Context) context.Context {
	return context.WithValue(ctx, key{}, Access{Role: "system", system: true})
}

func WithAuthAccess(ctx context.Context) context.Context {
	return context.WithValue(ctx, key{}, Access{Role: "authenticator", authenticator: true})
}

func IsSystem(access Access) bool {
	return access.system && access.Role == "system"
}

func IsAuthenticator(access Access) bool {
	return access.authenticator && access.Role == "authenticator"
}

func AccessFrom(ctx context.Context) (Access, bool) {
	access, ok := ctx.Value(key{}).(Access)
	return access, ok
}

func OrganizationID(ctx context.Context) domain.ID {
	access, ok := AccessFrom(ctx)
	if !ok {
		return ""
	}
	return access.OrganizationID
}

package postgres

import (
	"context"

	"crme/internal/authctx"
	"crme/internal/domain"
)

func (s *Store) CreateRuntimeSecret(ctx context.Context, scope, name string, ciphertext, nonce []byte) (domain.ID, error) {
	var id domain.ID
	var userID, organizationID domain.ID
	if access, ok := authctx.AccessFrom(ctx); ok {
		userID = access.UserID
		organizationID = access.OrganizationID
	}
	err := s.queryRow(ctx, `insert into runtime_secrets (scope, name, ciphertext, nonce, organization_id, owner_user_id) values ($1,$2,$3,$4,nullif($5,'')::uuid,nullif($6,'')::uuid) returning id`, scope, name, ciphertext, nonce, organizationID, userID).Scan(&id)
	return id, err
}

func (s *Store) GetRuntimeSecret(ctx context.Context, id domain.ID) (scope, name string, ciphertext, nonce []byte, err error) {
	err = s.queryRow(ctx, `select scope, name, ciphertext, nonce from runtime_secrets where id=$1`, id).Scan(&scope, &name, &ciphertext, &nonce)
	return scope, name, ciphertext, nonce, err
}

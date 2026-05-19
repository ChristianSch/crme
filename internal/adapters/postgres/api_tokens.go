package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"crme/internal/domain"
)

func (s *Store) ListAPITokens(ctx context.Context, userID, organizationID domain.ID) ([]domain.APIToken, error) {
	rows, err := s.query(ctx, `select id, organization_id, user_id, name, last_used_at, expires_at, created_at, updated_at from api_tokens where user_id=$1 and organization_id=$2 and revoked_at is null order by created_at desc`, userID, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.APIToken{}
	for rows.Next() {
		var token domain.APIToken
		if err := rows.Scan(&token.ID, &token.OrganizationID, &token.UserID, &token.Name, &token.LastUsedAt, &token.ExpiresAt, &token.CreatedAt, &token.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, token)
	}
	return out, rows.Err()
}

func (s *Store) CreateAPIToken(ctx context.Context, token domain.APIToken, tokenHash string) (domain.APIToken, error) {
	var out domain.APIToken
	err := s.queryRow(ctx, `insert into api_tokens (organization_id, user_id, name, token_hash, expires_at) values ($1,$2,$3,$4,$5) returning id, organization_id, user_id, name, last_used_at, expires_at, created_at, updated_at`, token.OrganizationID, token.UserID, token.Name, tokenHash, token.ExpiresAt).Scan(&out.ID, &out.OrganizationID, &out.UserID, &out.Name, &out.LastUsedAt, &out.ExpiresAt, &out.CreatedAt, &out.UpdatedAt)
	return out, err
}

func (s *Store) RevokeAPIToken(ctx context.Context, userID, organizationID, tokenID domain.ID, now time.Time) error {
	ct, err := s.exec(ctx, `update api_tokens set revoked_at=$4, updated_at=$4 where id=$1 and user_id=$2 and organization_id=$3 and revoked_at is null`, tokenID, userID, organizationID, now)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) UserByAPIToken(ctx context.Context, tokenHash string, now time.Time) (domain.User, domain.ID, string, error) {
	var user domain.User
	var organizationID domain.ID
	var role string
	err := s.queryRow(ctx, `update api_tokens t set last_used_at=$2, updated_at=$2 from users u join organization_members om on om.user_id=u.id where t.user_id=u.id and t.organization_id=om.organization_id and t.token_hash=$1 and t.revoked_at is null and (t.expires_at is null or t.expires_at > $2) and u.active returning u.id, u.email, u.created_at, u.updated_at, t.organization_id, om.role`, tokenHash, now).Scan(&user.ID, &user.Email, &user.CreatedAt, &user.UpdatedAt, &organizationID, &role)
	if errors.Is(err, pgx.ErrNoRows) {
		return user, "", "", errors.New("invalid api token")
	}
	return user, organizationID, role, err
}

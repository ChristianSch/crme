package postgres

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"crme/internal/authctx"
	"crme/internal/domain"
)

type Store struct {
	pool *pgxpool.Pool
	tx   pgx.Tx
}

type rlsRows struct {
	pgx.Rows
	tx    pgx.Tx
	sql   string
	start time.Time
}

func (r *rlsRows) Close() {
	r.Rows.Close()
	err := r.Rows.Err()
	if err != nil {
		_ = r.tx.Rollback(context.Background())
		logSlowDB("query", r.sql, r.start, err)
		return
	}
	err = r.tx.Commit(context.Background())
	logSlowDB("query", r.sql, r.start, err)
}

type timedRows struct {
	pgx.Rows
	sql   string
	start time.Time
}

func (r *timedRows) Close() {
	r.Rows.Close()
	logSlowDB("query", r.sql, r.start, r.Rows.Err())
}

type rlsRow struct {
	row   pgx.Row
	tx    pgx.Tx
	sql   string
	start time.Time
}

func (r rlsRow) Scan(dest ...any) error {
	err := r.row.Scan(dest...)
	if err != nil {
		_ = r.tx.Rollback(context.Background())
		logSlowDB("query_row", r.sql, r.start, err)
		return err
	}
	err = r.tx.Commit(context.Background())
	logSlowDB("query_row", r.sql, r.start, err)
	return err
}

type timedRow struct {
	row   pgx.Row
	sql   string
	start time.Time
}

func (r timedRow) Scan(dest ...any) error {
	err := r.row.Scan(dest...)
	logSlowDB("query_row", r.sql, r.start, err)
	return err
}

func logSlowDB(op, sql string, start time.Time, err error) {
	duration := time.Since(start)
	if duration < 250*time.Millisecond && (err == nil || errors.Is(err, pgx.ErrNoRows)) {
		return
	}
	attrs := []any{"op", op, "duration_ms", duration.Milliseconds(), "sql", compactSQL(sql)}
	if err != nil {
		attrs = append(attrs, "error", err)
	}
	slog.Warn("postgres query", attrs...)
}

func compactSQL(sql string) string {
	fields := strings.Fields(sql)
	out := strings.Join(fields, " ")
	if len(out) > 500 {
		return out[:500]
	}
	return out
}

func New(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{pool: pool}, nil
}
func (s *Store) Close() { s.pool.Close() }

func (s *Store) exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	start := time.Now()
	if s.tx != nil {
		if err := setRLSContext(ctx, s.tx); err != nil {
			logSlowDB("exec", sql, start, err)
			return pgconn.CommandTag{}, err
		}
		ct, err := s.tx.Exec(ctx, sql, args...)
		logSlowDB("exec", sql, start, err)
		return ct, err
	}
	if _, ok := authctx.AccessFrom(ctx); ok {
		tx, err := s.begin(ctx)
		if err != nil {
			logSlowDB("exec", sql, start, err)
			return pgconn.CommandTag{}, err
		}
		defer tx.Rollback(ctx)
		ct, err := tx.Exec(ctx, sql, args...)
		if err != nil {
			logSlowDB("exec", sql, start, err)
			return ct, err
		}
		err = tx.Commit(ctx)
		logSlowDB("exec", sql, start, err)
		return ct, err
	}
	if requiresTenantAccess(sql) {
		err := errors.New("tenant table access requires auth context")
		logSlowDB("exec", sql, start, err)
		return pgconn.CommandTag{}, err
	}
	ct, err := s.pool.Exec(ctx, sql, args...)
	logSlowDB("exec", sql, start, err)
	return ct, err
}

func (s *Store) query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	start := time.Now()
	if s.tx != nil {
		if err := setRLSContext(ctx, s.tx); err != nil {
			logSlowDB("query", sql, start, err)
			return nil, err
		}
		rows, err := s.tx.Query(ctx, sql, args...)
		if err != nil {
			logSlowDB("query", sql, start, err)
			return nil, err
		}
		return &timedRows{Rows: rows, sql: sql, start: start}, nil
	}
	if _, ok := authctx.AccessFrom(ctx); ok {
		tx, err := s.begin(ctx)
		if err != nil {
			logSlowDB("query", sql, start, err)
			return nil, err
		}
		rows, err := tx.Query(ctx, sql, args...)
		if err != nil {
			_ = tx.Rollback(ctx)
			logSlowDB("query", sql, start, err)
			return nil, err
		}
		return &rlsRows{Rows: rows, tx: tx, sql: sql, start: start}, nil
	}
	if requiresTenantAccess(sql) {
		err := errors.New("tenant table access requires auth context")
		logSlowDB("query", sql, start, err)
		return nil, err
	}
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		logSlowDB("query", sql, start, err)
		return nil, err
	}
	return &timedRows{Rows: rows, sql: sql, start: start}, nil
}

func (s *Store) queryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	start := time.Now()
	if s.tx != nil {
		if err := setRLSContext(ctx, s.tx); err != nil {
			logSlowDB("query_row", sql, start, err)
			return errorRow{err: err}
		}
		return timedRow{row: s.tx.QueryRow(ctx, sql, args...), sql: sql, start: start}
	}
	if _, ok := authctx.AccessFrom(ctx); ok {
		tx, err := s.begin(ctx)
		if err != nil {
			logSlowDB("query_row", sql, start, err)
			return errorRow{err: err}
		}
		return rlsRow{row: tx.QueryRow(ctx, sql, args...), tx: tx, sql: sql, start: start}
	}
	if requiresTenantAccess(sql) {
		err := errors.New("tenant table access requires auth context")
		logSlowDB("query_row", sql, start, err)
		return errorRow{err: err}
	}
	return timedRow{row: s.pool.QueryRow(ctx, sql, args...), sql: sql, start: start}
}

type errorRow struct{ err error }

func (r errorRow) Scan(dest ...any) error { return r.err }

func (s *Store) begin(ctx context.Context) (pgx.Tx, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	if err := setRLSContext(ctx, tx); err != nil {
		_ = tx.Rollback(ctx)
		return nil, err
	}
	return tx, nil
}

func setRLSContext(ctx context.Context, tx pgx.Tx) error {
	access, ok := authctx.AccessFrom(ctx)
	if !ok {
		return nil
	}
	if access.Role == "system" && !authctx.IsSystem(access) {
		return errors.New("system access requires authctx.WithSystemAccess")
	}
	if access.Role == "authenticator" && !authctx.IsAuthenticator(access) {
		return errors.New("authenticator access requires authctx.WithAuthAccess")
	}
	_, err := tx.Exec(ctx, `select set_config('app.user_id', $1, true), set_config('app.organization_id', $2, true), set_config('app.role', $3, true)`, access.UserID, access.OrganizationID, access.Role)
	return err
}

func organizationID(ctx context.Context) domain.ID {
	return authctx.OrganizationID(ctx)
}

func requiresTenantAccess(sql string) bool {
	lower := strings.ToLower(sql)
	for _, table := range tenantTables {
		if strings.Contains(lower, table) {
			return true
		}
	}
	return false
}

var tenantTables = []string{
	"organizations",
	"organization_members",
	"organization_invitations",
	"workspaces",
	"people",
	"companies",
	"deals",
	"todos",
	"tags",
	"person_emails",
	"company_domains",
	"person_companies",
	"deal_people",
	"deal_companies",
	"workspace_people",
	"workspace_companies",
	"entity_tags",
	"activity_links",
	"activities",
	"ai_prompts",
	"suggestion_suppressions",
	"assistant_conversations",
	"email_accounts",
	"email_messages",
	"runtime_secrets",
	"audit_logs",
	"api_tokens",
}

func (s *Store) HasUsers(ctx context.Context) (bool, error) {
	var exists bool
	err := s.queryRow(ctx, `select exists(select 1 from users)`).Scan(&exists)
	return exists, err
}

func (s *Store) CreateUser(ctx context.Context, email, role string, active bool) (domain.ID, error) {
	var id domain.ID
	err := s.queryRow(ctx, `insert into users (email, role, active) values (lower($1),$2,$3) returning id`, email, role, active).Scan(&id)
	return id, err
}

func (s *Store) ActiveUserByEmail(ctx context.Context, email string) (domain.ID, bool, error) {
	var id domain.ID
	err := s.queryRow(ctx, `select id from users where lower(email)=lower($1) and active`, email).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return id, true, nil
}

func (s *Store) CreateMagicLink(ctx context.Context, email, tokenHash string, expiresAt time.Time) error {
	_, err := s.exec(ctx, `insert into magic_links (email, token_hash, expires_at) values ($1,$2,$3)`, email, tokenHash, expiresAt)
	return err
}
func (s *Store) ConsumeMagicLink(ctx context.Context, tokenHash string, now time.Time) (string, error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	var email string
	err = tx.QueryRow(ctx, `select email from magic_links where token_hash=$1 and consumed_at is null and expires_at > $2 for update`, tokenHash, now).Scan(&email)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", fmt.Errorf("invalid or expired magic link")
	}
	if err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `update magic_links set consumed_at=$1 where token_hash=$2`, now, tokenHash); err != nil {
		return "", err
	}
	return email, tx.Commit(ctx)
}
func (s *Store) CreateSession(ctx context.Context, userID domain.ID, email, tokenHash string, expiresAt time.Time) error {
	_, err := s.exec(ctx, `insert into sessions (user_id, email, token_hash, expires_at, last_seen_at) values ($1,$2,$3,$4,now())`, userID, email, tokenHash, expiresAt)
	return err
}

func (s *Store) ValidateSession(ctx context.Context, tokenHash string, now time.Time) (string, error) {
	var email string
	err := s.queryRow(ctx, `update sessions s set last_seen_at=$2 from users u where s.user_id=u.id and s.token_hash=$1 and s.expires_at > $2 and s.revoked_at is null and u.active returning s.email`, tokenHash, now).Scan(&email)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", fmt.Errorf("invalid session")
	}
	return email, err
}

func (s *Store) RevokeSession(ctx context.Context, tokenHash string, now time.Time) error {
	ct, err := s.exec(ctx, `update sessions set revoked_at=$2 where token_hash=$1 and revoked_at is null`, tokenHash, now)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) UserBySession(ctx context.Context, tokenHash string, now time.Time) (domain.User, error) {
	var u domain.User
	err := s.queryRow(ctx, `update sessions s set last_seen_at=$2 from users u where s.user_id=u.id and s.token_hash=$1 and s.expires_at > $2 and s.revoked_at is null and u.active returning u.id, u.email, u.created_at, u.updated_at`, tokenHash, now).Scan(&u.ID, &u.Email, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return u, fmt.Errorf("invalid session")
	}
	return u, err
}

func (s *Store) ListOrganizationsForUser(ctx context.Context, userID domain.ID) ([]domain.OrganizationMembership, error) {
	rows, err := s.query(ctx, `select om.organization_id, om.user_id, om.role, o.name, om.created_at, om.updated_at from organization_members om join organizations o on o.id=om.organization_id where om.user_id=$1 order by o.name`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.OrganizationMembership{}
	for rows.Next() {
		var m domain.OrganizationMembership
		if err := rows.Scan(&m.OrganizationID, &m.UserID, &m.Role, &m.Name, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) CreateOrganizationWithOwner(ctx context.Context, name string, ownerUserID domain.ID) (domain.Organization, error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return domain.Organization{}, err
	}
	defer tx.Rollback(ctx)
	var org domain.Organization
	if err := tx.QueryRow(ctx, `insert into organizations (name) values ($1) returning id, name, created_at, updated_at`, name).Scan(&org.ID, &org.Name, &org.CreatedAt, &org.UpdatedAt); err != nil {
		return org, err
	}
	if _, err := tx.Exec(ctx, `insert into organization_members (organization_id, user_id, role) values ($1,$2,'owner')`, org.ID, ownerUserID); err != nil {
		return org, err
	}
	return org, tx.Commit(ctx)
}

func (s *Store) ListOrganizationMembers(ctx context.Context, organizationID domain.ID) ([]domain.OrganizationMember, error) {
	rows, err := s.query(ctx, `select om.organization_id, om.user_id, u.email, om.role, om.created_at, om.updated_at from organization_members om join users u on u.id=om.user_id where om.organization_id=$1 order by case om.role when 'owner' then 0 when 'admin' then 1 when 'member' then 2 else 3 end, u.email`, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.OrganizationMember{}
	for rows.Next() {
		var m domain.OrganizationMember
		if err := rows.Scan(&m.OrganizationID, &m.UserID, &m.Email, &m.Role, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) UpdateOrganizationMemberRole(ctx context.Context, organizationID, userID domain.ID, role string) (domain.OrganizationMember, error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return domain.OrganizationMember{}, err
	}
	defer tx.Rollback(ctx)
	var m domain.OrganizationMember
	err = tx.QueryRow(ctx, `update organization_members set role=$3, updated_at=now() where organization_id=$1 and user_id=$2 returning organization_id, user_id, (select email from users where id=$2), role, created_at, updated_at`, organizationID, userID, role).Scan(&m.OrganizationID, &m.UserID, &m.Email, &m.Role, &m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		return m, err
	}
	return m, tx.Commit(ctx)
}

func (s *Store) RemoveOrganizationMember(ctx context.Context, organizationID, userID domain.ID) error {
	tx, err := s.begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	ct, err := tx.Exec(ctx, `delete from organization_members where organization_id=$1 and user_id=$2`, organizationID, userID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return tx.Commit(ctx)
}

func (s *Store) CreateOrganizationInvitation(ctx context.Context, organizationID domain.ID, email, role, tokenHash string, expiresAt time.Time, invitedByUserID domain.ID) (domain.OrganizationInvitation, error) {
	var inv domain.OrganizationInvitation
	err := s.queryRow(ctx, `insert into organization_invitations (organization_id,email,role,token_hash,expires_at,invited_by_user_id) values ($1,lower($2),$3,$4,$5,$6) returning id, organization_id, (select name from organizations where id=$1), email, role, expires_at, accepted_at, created_at`, organizationID, email, role, tokenHash, expiresAt, invitedByUserID).Scan(&inv.ID, &inv.OrganizationID, &inv.OrganizationName, &inv.Email, &inv.Role, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt)
	return inv, err
}

func (s *Store) ListOrganizationInvitations(ctx context.Context, organizationID domain.ID) ([]domain.OrganizationInvitation, error) {
	rows, err := s.query(ctx, `select oi.id, oi.organization_id, o.name, oi.email, oi.role, oi.expires_at, oi.accepted_at, oi.created_at from organization_invitations oi join organizations o on o.id=oi.organization_id where oi.organization_id=$1 order by oi.created_at desc`, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.OrganizationInvitation{}
	for rows.Next() {
		var inv domain.OrganizationInvitation
		if err := rows.Scan(&inv.ID, &inv.OrganizationID, &inv.OrganizationName, &inv.Email, &inv.Role, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, inv)
	}
	return out, rows.Err()
}

func (s *Store) GetOrganizationInvitation(ctx context.Context, tokenHash string, now time.Time) (domain.OrganizationInvitation, error) {
	var inv domain.OrganizationInvitation
	err := s.queryRow(ctx, `select oi.id, oi.organization_id, o.name, oi.email, oi.role, oi.expires_at, oi.accepted_at, oi.created_at from organization_invitations oi join organizations o on o.id=oi.organization_id where oi.token_hash=$1 and oi.expires_at > $2`, tokenHash, now).Scan(&inv.ID, &inv.OrganizationID, &inv.OrganizationName, &inv.Email, &inv.Role, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return inv, fmt.Errorf("invalid or expired invitation")
	}
	return inv, err
}

func (s *Store) UpdateOrganizationInvitationToken(ctx context.Context, organizationID, invitationID domain.ID, tokenHash string, expiresAt time.Time) (domain.OrganizationInvitation, error) {
	var inv domain.OrganizationInvitation
	err := s.queryRow(ctx, `update organization_invitations oi set token_hash=$3, expires_at=$4 from organizations o where oi.organization_id=o.id and oi.organization_id=$1 and oi.id=$2 and oi.accepted_at is null returning oi.id, oi.organization_id, o.name, oi.email, oi.role, oi.expires_at, oi.accepted_at, oi.created_at`, organizationID, invitationID, tokenHash, expiresAt).Scan(&inv.ID, &inv.OrganizationID, &inv.OrganizationName, &inv.Email, &inv.Role, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt)
	return inv, err
}

func (s *Store) AcceptOrganizationInvitation(ctx context.Context, tokenHash string, now time.Time, userID domain.ID) (domain.OrganizationInvitation, error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return domain.OrganizationInvitation{}, err
	}
	defer tx.Rollback(ctx)
	var inv domain.OrganizationInvitation
	err = tx.QueryRow(ctx, `select oi.id, oi.organization_id, o.name, oi.email, oi.role, oi.expires_at, oi.accepted_at, oi.created_at from organization_invitations oi join organizations o on o.id=oi.organization_id where oi.token_hash=$1 and oi.expires_at > $2 for update`, tokenHash, now).Scan(&inv.ID, &inv.OrganizationID, &inv.OrganizationName, &inv.Email, &inv.Role, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return inv, fmt.Errorf("invalid or expired invitation")
	}
	if err != nil {
		return inv, err
	}
	if inv.AcceptedAt != nil {
		return inv, fmt.Errorf("invitation already accepted")
	}
	if _, err := tx.Exec(ctx, `insert into organization_members (organization_id,user_id,role) values ($1,$2,$3) on conflict (organization_id,user_id) do update set role=excluded.role, updated_at=now()`, inv.OrganizationID, userID, inv.Role); err != nil {
		return inv, err
	}
	if err := tx.QueryRow(ctx, `update organization_invitations set accepted_at=$2 where token_hash=$1 returning accepted_at`, tokenHash, now).Scan(&inv.AcceptedAt); err != nil {
		return inv, err
	}
	return inv, tx.Commit(ctx)
}

package postgres

import (
	"context"
	"errors"
	"time"

	"crme/internal/authctx"

	"github.com/jackc/pgx/v5"

	"crme/internal/domain"
)

func (s *Store) CreateAIPrompt(ctx context.Context, p domain.AIPrompt) (domain.AIPrompt, error) {
	err := s.queryRow(ctx, `insert into ai_prompts (organization_id,kind,entity_type,entity_id,target_type,target_identifier,title,body,status,last_touch_at) values ($1::uuid,$2,$3,nullif($4,'')::uuid,$5,lower($6),$7,$8,$9,$10) returning id, target_type, target_identifier, last_touch_at, created_at`, organizationID(ctx), p.Kind, p.EntityType, p.EntityID, p.TargetType, p.TargetIdentifier, p.Title, p.Body, p.Status, p.LastTouchAt).Scan(&p.ID, &p.TargetType, &p.TargetIdentifier, &p.LastTouchAt, &p.CreatedAt)
	return p, err
}

func (s *Store) GetAIPrompt(ctx context.Context, id domain.ID) (domain.AIPrompt, error) {
	var p domain.AIPrompt
	err := s.queryRow(ctx, `select id, kind, entity_type, coalesce(entity_id::text,''), target_type, target_identifier, title, body, status, last_touch_at, created_at from ai_prompts where id=$1`, id).Scan(&p.ID, &p.Kind, &p.EntityType, &p.EntityID, &p.TargetType, &p.TargetIdentifier, &p.Title, &p.Body, &p.Status, &p.LastTouchAt, &p.CreatedAt)
	return p, err
}

func (s *Store) AIPromptExists(ctx context.Context, kind domain.AIPromptKind, title string, status string) (bool, error) {
	var exists bool
	err := s.queryRow(ctx, `select exists(select 1 from ai_prompts where kind=$1 and title=$2 and ($3='' or status=$3))`, kind, title, status).Scan(&exists)
	return exists, err
}

func (s *Store) IsSuggestionSuppressed(ctx context.Context, kind domain.AIPromptKind, targetType string, targetIdentifier string) (bool, error) {
	var exists bool
	err := s.queryRow(ctx, `select exists(select 1 from suggestion_suppressions where kind=$1 and target_type=$2 and lower(target_identifier)=lower($3))`, kind, targetType, targetIdentifier).Scan(&exists)
	return exists, err
}

func (s *Store) SuppressSuggestion(ctx context.Context, kind domain.AIPromptKind, targetType string, targetIdentifier string, reason string) error {
	_, err := s.exec(ctx, `insert into suggestion_suppressions (organization_id,kind,target_type,target_identifier,value,reason) values ($1::uuid,$2,$3,lower($4),lower($4),$5) on conflict (organization_id,kind,target_type,target_identifier) do update set reason=excluded.reason`, organizationID(ctx), kind, targetType, targetIdentifier, reason)
	return err
}

func (s *Store) UnsuppressSuggestion(ctx context.Context, kind domain.AIPromptKind, targetType string, targetIdentifier string) error {
	_, err := s.exec(ctx, `delete from suggestion_suppressions where kind=$1 and target_type=$2 and lower(target_identifier)=lower($3)`, kind, targetType, targetIdentifier)
	return err
}

func (s *Store) ListAIPrompts(ctx context.Context, status string, limit int) ([]domain.AIPrompt, error) {
	rows, err := s.query(ctx, `select id, kind, entity_type, coalesce(entity_id::text,''), target_type, target_identifier, title, body, status, last_touch_at, created_at from ai_prompts where $1='' or status=$1 order by coalesce(last_touch_at, created_at) desc limit $2`, status, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.AIPrompt
	for rows.Next() {
		var p domain.AIPrompt
		if err := rows.Scan(&p.ID, &p.Kind, &p.EntityType, &p.EntityID, &p.TargetType, &p.TargetIdentifier, &p.Title, &p.Body, &p.Status, &p.LastTouchAt, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) ResolveAIPrompt(ctx context.Context, id domain.ID, status string) (domain.AIPrompt, error) {
	var p domain.AIPrompt
	err := s.queryRow(ctx, `update ai_prompts set status=$2, resolved_at=case when $2='open' then null else now() end where id=$1 returning id, kind, entity_type, coalesce(entity_id::text,''), target_type, target_identifier, title, body, status, last_touch_at, created_at`, id, status).Scan(&p.ID, &p.Kind, &p.EntityType, &p.EntityID, &p.TargetType, &p.TargetIdentifier, &p.Title, &p.Body, &p.Status, &p.LastTouchAt, &p.CreatedAt)
	return p, err
}

func (s *Store) CreateEmailAccount(ctx context.Context, a domain.EmailAccount) (domain.EmailAccount, error) {
	ownerID := a.OwnerUserID
	if access, ok := authctx.AccessFrom(ctx); ok {
		ownerID = access.UserID
	}
	err := s.queryRow(ctx, `insert into email_accounts (organization_id,owner_user_id,name,email,imap_host,imap_port,imap_username,smtp_host,smtp_port,smtp_username,secret_ref,sync_enabled) values ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id, organization_id, owner_user_id, created_at, updated_at, last_synced_at`, organizationID(ctx), ownerID, a.Name, a.Email, a.IMAPHost, a.IMAPPort, a.IMAPUsername, a.SMTPHost, a.SMTPPort, a.SMTPUsername, a.SecretRef, a.SyncEnabled).Scan(&a.ID, &a.OrganizationID, &a.OwnerUserID, &a.CreatedAt, &a.UpdatedAt, &a.LastSyncedAt)
	return a, err
}

func (s *Store) GetEmailAccount(ctx context.Context, id domain.ID) (domain.EmailAccount, error) {
	accounts, err := s.listEmailAccounts(ctx, `select id,organization_id,owner_user_id,name,email,imap_host,imap_port,imap_username,smtp_host,smtp_port,smtp_username,secret_ref,sync_enabled,last_synced_at,created_at,updated_at from email_accounts where id=$1 and organization_id=$2::uuid`, id, organizationID(ctx))
	if err != nil {
		return domain.EmailAccount{}, err
	}
	if len(accounts) == 0 {
		return domain.EmailAccount{}, pgx.ErrNoRows
	}
	return accounts[0], nil
}

func (s *Store) ListEmailAccounts(ctx context.Context, limit int) ([]domain.EmailAccount, error) {
	return s.listEmailAccounts(ctx, `select id,organization_id,owner_user_id,name,email,imap_host,imap_port,imap_username,smtp_host,smtp_port,smtp_username,secret_ref,sync_enabled,last_synced_at,created_at,updated_at from email_accounts where organization_id=$2::uuid order by created_at desc limit $1`, limit, organizationID(ctx))
}

func (s *Store) UpdateEmailAccount(ctx context.Context, a domain.EmailAccount) (domain.EmailAccount, error) {
	err := s.queryRow(ctx, `update email_accounts set name=$2,email=$3,imap_host=$4,imap_port=$5,imap_username=$6,smtp_host=$7,smtp_port=$8,smtp_username=$9,secret_ref=case when $10='' then secret_ref else $10 end,sync_enabled=$11,updated_at=now() where id=$1 and organization_id=$12::uuid returning organization_id, owner_user_id, created_at, updated_at, last_synced_at`, a.ID, a.Name, a.Email, a.IMAPHost, a.IMAPPort, a.IMAPUsername, a.SMTPHost, a.SMTPPort, a.SMTPUsername, a.SecretRef, a.SyncEnabled, organizationID(ctx)).Scan(&a.OrganizationID, &a.OwnerUserID, &a.CreatedAt, &a.UpdatedAt, &a.LastSyncedAt)
	return a, err
}

func (s *Store) DeleteEmailAccount(ctx context.Context, id domain.ID) error {
	_, err := s.exec(ctx, `delete from email_accounts where id=$1 and organization_id=$2::uuid`, id, organizationID(ctx))
	return err
}

func (s *Store) ListSyncEnabledEmailAccounts(ctx context.Context, limit int) ([]domain.EmailAccount, error) {
	return s.listEmailAccounts(ctx, `select id,organization_id,owner_user_id,name,email,imap_host,imap_port,imap_username,smtp_host,smtp_port,smtp_username,secret_ref,sync_enabled,last_synced_at,created_at,updated_at from email_accounts where sync_enabled and secret_ref <> '' order by coalesce(last_synced_at, 'epoch'::timestamptz), created_at limit $1`, limit)
}

func (s *Store) listEmailAccounts(ctx context.Context, sql string, args ...any) ([]domain.EmailAccount, error) {
	rows, err := s.query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.EmailAccount
	for rows.Next() {
		var a domain.EmailAccount
		if err := rows.Scan(&a.ID, &a.OrganizationID, &a.OwnerUserID, &a.Name, &a.Email, &a.IMAPHost, &a.IMAPPort, &a.IMAPUsername, &a.SMTPHost, &a.SMTPPort, &a.SMTPUsername, &a.SecretRef, &a.SyncEnabled, &a.LastSyncedAt, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		a.Secret = ""
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *Store) UpsertEmailMessage(ctx context.Context, m domain.EmailMessage) (bool, error) {
	var inserted bool
	ownerID := m.OwnerUserID
	if access, ok := authctx.AccessFrom(ctx); ok {
		ownerID = access.UserID
	}
	err := s.queryRow(ctx, `insert into email_messages (organization_id,owner_user_id,email_account_id,message_id,thread_key,direction,from_email,to_emails,subject,body_text,sent_at) values ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (organization_id, message_id) do nothing returning true`, organizationID(ctx), ownerID, m.EmailAccountID, m.MessageID, m.ThreadKey, m.Direction, m.FromEmail, m.ToEmails, m.Subject, m.BodyText, m.SentAt).Scan(&inserted)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return inserted, nil
}

func (s *Store) SetEmailMessageActivity(ctx context.Context, messageID string, activityID domain.ID) error {
	_, err := s.exec(ctx, `update email_messages set activity_id=$2 where message_id=$1 and activity_id is null and organization_id=$3::uuid`, messageID, activityID, organizationID(ctx))
	return err
}

func (s *Store) ListEmailMessagesForAddress(ctx context.Context, email string, limit int) ([]domain.EmailMessage, error) {
	rows, err := s.query(ctx, `select id,email_account_id,owner_user_id,coalesce(activity_id::text,''),message_id,thread_key,direction,from_email,to_emails,subject,body_text,sent_at,created_at from email_messages where organization_id=$3::uuid and (lower(from_email)=lower($1) or exists (select 1 from unnest(to_emails) e where lower(e)=lower($1))) order by sent_at desc limit $2`, email, limit, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEmailMessages(rows)
}

func (s *Store) ListEmailMessagesForDomain(ctx context.Context, domainName string, limit int) ([]domain.EmailMessage, error) {
	suffix := "%@" + domainName
	rows, err := s.query(ctx, `select id,email_account_id,owner_user_id,coalesce(activity_id::text,''),message_id,thread_key,direction,from_email,to_emails,subject,body_text,sent_at,created_at from email_messages where organization_id=$3::uuid and (lower(from_email) like lower($1) or exists (select 1 from unnest(to_emails) e where lower(e) like lower($1))) order by sent_at desc limit $2`, suffix, limit, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEmailMessages(rows)
}

func scanEmailMessages(rows pgx.Rows) ([]domain.EmailMessage, error) {
	var out []domain.EmailMessage
	for rows.Next() {
		var m domain.EmailMessage
		if err := rows.Scan(&m.ID, &m.EmailAccountID, &m.OwnerUserID, &m.ActivityID, &m.MessageID, &m.ThreadKey, &m.Direction, &m.FromEmail, &m.ToEmails, &m.Subject, &m.BodyText, &m.SentAt, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) TouchPerson(ctx context.Context, id domain.ID, at time.Time) error {
	_, err := s.exec(ctx, `update people set last_touch_at=greatest(coalesce(last_touch_at, '-infinity'::timestamptz), $2), updated_at=now() where id=$1 and organization_id=$3::uuid`, id, at, organizationID(ctx))
	return err
}

func (s *Store) TouchCompany(ctx context.Context, id domain.ID, at time.Time) error {
	_, err := s.exec(ctx, `update companies set last_touch_at=greatest(coalesce(last_touch_at, '-infinity'::timestamptz), $2), updated_at=now() where id=$1 and organization_id=$3::uuid`, id, at, organizationID(ctx))
	return err
}

func (s *Store) MarkEmailAccountSynced(ctx context.Context, id domain.ID, at time.Time) error {
	_, err := s.exec(ctx, `update email_accounts set last_synced_at=$2, updated_at=now() where id=$1`, id, at)
	return err
}

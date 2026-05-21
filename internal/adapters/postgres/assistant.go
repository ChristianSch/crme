package postgres

import (
	"context"
	"encoding/json"
	"time"

	"crme/internal/domain"
)

func (s *Store) ListAssistantConversations(ctx context.Context, sessionID domain.ID, limit int) ([]domain.AssistantConversation, error) {
	rows, err := s.query(ctx, `select id, session_id, title, messages, coalesce(pending_action, 'null'::jsonb), created_at, updated_at from assistant_conversations where session_id=$1 and organization_id=$3::uuid order by updated_at desc limit $2`, sessionID, limit, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.AssistantConversation
	for rows.Next() {
		var c domain.AssistantConversation
		var raw []byte
		var rawAction []byte
		if err := rows.Scan(&c.ID, &c.SessionID, &c.Title, &raw, &rawAction, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(raw, &c.Messages); err != nil {
			return nil, err
		}
		if string(rawAction) != "null" {
			if err := json.Unmarshal(rawAction, &c.PendingAction); err != nil {
				return nil, err
			}
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) UpsertAssistantConversation(ctx context.Context, c domain.AssistantConversation) (domain.AssistantConversation, error) {
	raw, err := json.Marshal(c.Messages)
	if err != nil {
		return c, err
	}
	rawAction, err := json.Marshal(c.PendingAction)
	if err != nil {
		return c, err
	}
	if c.ID == "" {
		err = s.queryRow(ctx, `insert into assistant_conversations (organization_id,session_id,title,messages,pending_action) values ($1::uuid,$2,$3,$4,$5) returning id, created_at, updated_at`, organizationID(ctx), c.SessionID, c.Title, raw, rawAction).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
		return c, err
	}
	err = s.queryRow(ctx, `insert into assistant_conversations (id,organization_id,session_id,title,messages,pending_action) values ($1,$2::uuid,$3,$4,$5,$6)
	on conflict (id) do update set title=excluded.title, messages=excluded.messages, pending_action=excluded.pending_action, updated_at=now()
	where assistant_conversations.session_id=excluded.session_id and assistant_conversations.organization_id=excluded.organization_id
	returning created_at, updated_at`, c.ID, organizationID(ctx), c.SessionID, c.Title, raw, rawAction).Scan(&c.CreatedAt, &c.UpdatedAt)
	return c, err
}

func (s *Store) CleanupAssistantConversations(ctx context.Context, before time.Time) (int64, error) {
	ct, err := s.exec(ctx, `delete from assistant_conversations where updated_at < $1`, before)
	if err != nil {
		return 0, err
	}
	return ct.RowsAffected(), nil
}

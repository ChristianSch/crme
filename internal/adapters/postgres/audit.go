package postgres

import (
	"context"
	"encoding/json"

	"crme/internal/authctx"
	"crme/internal/domain"
)

func (s *Store) CreateAuditLog(ctx context.Context, log domain.AuditLog) (domain.AuditLog, error) {
	if access, ok := authctx.AccessFrom(ctx); ok {
		if log.OrganizationID == "" {
			log.OrganizationID = access.OrganizationID
		}
		if log.ActorUserID == "" {
			log.ActorUserID = access.UserID
		}
	}
	details := log.Details
	if details == nil {
		details = map[string]any{}
	}
	rawDetails, err := json.Marshal(details)
	if err != nil {
		return log, err
	}
	_, err = s.exec(ctx, `insert into audit_logs (organization_id,actor_user_id,action,target_type,target_id,details) values ($1::uuid,nullif($2,'')::uuid,$3,$4,nullif($5,'')::uuid,$6)`, log.OrganizationID, log.ActorUserID, log.Action, log.TargetType, log.TargetID, rawDetails)
	return log, err
}

func (s *Store) ListAuditLogs(ctx context.Context, organizationID domain.ID, limit, offset int) ([]domain.AuditLog, error) {
	rows, err := s.query(ctx, `select al.id, al.organization_id, coalesce(al.actor_user_id::text,''), coalesce(u.email,''), al.action, al.target_type, coalesce(al.target_id::text,''), al.details, al.created_at from audit_logs al left join users u on u.id=al.actor_user_id where al.organization_id=$1::uuid order by al.created_at desc, al.id desc limit $2 offset $3`, organizationID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.AuditLog{}
	for rows.Next() {
		var log domain.AuditLog
		var rawDetails []byte
		if err := rows.Scan(&log.ID, &log.OrganizationID, &log.ActorUserID, &log.ActorEmail, &log.Action, &log.TargetType, &log.TargetID, &rawDetails, &log.CreatedAt); err != nil {
			return nil, err
		}
		if len(rawDetails) > 0 {
			if err := json.Unmarshal(rawDetails, &log.Details); err != nil {
				return nil, err
			}
		}
		out = append(out, log)
	}
	return out, rows.Err()
}

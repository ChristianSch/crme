package postgres

import (
	"context"

	"crme/internal/domain"
)

func (s *Store) AdminStats(ctx context.Context, organizationID domain.ID) (domain.AdminStats, error) {
	var stats domain.AdminStats
	err := s.queryRow(ctx, `
		select
			(select count(*)::int from organization_members where organization_id=$1),
			(select count(*)::int from organizations where id=$1),
			(select count(*)::int from workspaces where organization_id=$1),
			(select count(*)::int from people where organization_id=$1),
			(select count(*)::int from companies where organization_id=$1),
			(select count(*)::int from deals where organization_id=$1),
			(select count(*)::int from todos where organization_id=$1 and status='open'),
			(select count(*)::int from tags where organization_id=$1),
			(select count(*)::int from activities where organization_id=$1),
			(select count(*)::int from email_accounts where organization_id=$1),
			(select count(*)::int from ai_prompts where organization_id=$1 and status='open'),
			(select count(*)::int from audit_logs where organization_id=$1)
	`, organizationID).Scan(
		&stats.Users,
		&stats.Organizations,
		&stats.Workspaces,
		&stats.People,
		&stats.Companies,
		&stats.Deals,
		&stats.OpenTasks,
		&stats.Tags,
		&stats.Activities,
		&stats.EmailAccounts,
		&stats.OpenSuggestions,
		&stats.AuditLogs,
	)
	return stats, err
}

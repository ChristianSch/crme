package postgres

import (
	"context"
	"fmt"
	"strings"
)

func (s *Store) CheckRequiredTables(ctx context.Context) error {
	required := []string{
		"users",
		"sessions",
		"magic_links",
		"people",
		"companies",
		"deals",
		"activities",
		"todos",
		"ai_prompts",
		"email_accounts",
		"email_sync_cursors",
		"runtime_secrets",
		"workspaces",
		"assistant_conversations",
		"organizations",
		"organization_members",
		"organization_invitations",
		"audit_logs",
		"api_tokens",
	}
	missing := []string{}
	for _, table := range required {
		var exists bool
		if err := s.queryRow(ctx, `select to_regclass($1) is not null`, "public."+table).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			missing = append(missing, table)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("database schema is missing tables: %s; run tern migrate --config tern.conf --migrations migrations", strings.Join(missing, ", "))
	}
	return nil
}

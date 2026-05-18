package postgres

import (
	"context"
	"time"

	"crme/internal/usecase"
)

func (s *Store) CleanupAuthArtifacts(ctx context.Context, now time.Time, revokedSessionRetention time.Duration) (usecase.HousekeepingReport, error) {
	var report usecase.HousekeepingReport
	magicLinks, err := s.exec(ctx, `delete from magic_links where consumed_at is not null or expires_at <= $1`, now)
	if err != nil {
		return report, err
	}
	report.DeletedMagicLinks = magicLinks.RowsAffected()
	sessions, err := s.exec(ctx, `delete from sessions where expires_at <= $1 or (revoked_at is not null and revoked_at <= $2)`, now, now.Add(-revokedSessionRetention))
	if err != nil {
		return report, err
	}
	report.DeletedSessions = sessions.RowsAffected()
	return report, nil
}

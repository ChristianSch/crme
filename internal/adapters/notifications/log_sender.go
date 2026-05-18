package notifications

import (
	"context"
	"log/slog"
)

type LogMagicLinkSender struct{}

func (LogMagicLinkSender) SendMagicLink(ctx context.Context, email, url string) error {
	slog.InfoContext(ctx, "magic link", "email", email, "url", url)
	return nil
}

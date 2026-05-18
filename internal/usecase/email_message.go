package usecase

import (
	"context"
	"fmt"
	"strings"

	"crme/internal/domain"
)

func (s EmailService) SetMessageActivity(ctx context.Context, messageID string, activityID domain.ID) error {
	messageID = strings.TrimSpace(messageID)
	if messageID == "" || activityID == "" {
		return fmt.Errorf("%w: message and activity are required", ErrValidation)
	}
	return s.Messages.SetEmailMessageActivity(ctx, messageID, activityID)
}

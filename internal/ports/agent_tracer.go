package ports

import (
	"context"
	"time"

	"crme/internal/domain"
)

type AgentTrace struct {
	ID          string
	DottedOrder string
}

type AgentTracer interface {
	StartChat(ctx context.Context, input AgentChatStart) AgentTrace
	EndChat(ctx context.Context, trace AgentTrace, event AgentChatEnd)
	RecordLLM(ctx context.Context, trace AgentTrace, event AgentLLMEvent)
	RecordTool(ctx context.Context, trace AgentTrace, event AgentToolEvent)
	RecordAction(ctx context.Context, trace AgentTrace, event AgentActionEvent)
}

type AgentChatStart struct {
	ConversationID domain.ID
	MessageCount   int
	StartedAt      time.Time
}

type AgentChatEnd struct {
	Output   domain.AICompletion
	Error    error
	EndedAt  time.Time
	Duration time.Duration
}

type AgentLLMEvent struct {
	Iteration int
	Request   domain.AICompletionRequest
	Output    domain.AICompletion
	Error     error
	StartedAt time.Time
	Duration  time.Duration
}

type AgentToolEvent struct {
	Iteration int
	Tool      string
	Args      map[string]any
	Result    any
	Error     error
	StartedAt time.Time
	Duration  time.Duration
}

type AgentActionEvent struct {
	Command   string
	Args      []string
	Result    any
	Error     error
	StartedAt time.Time
	Duration  time.Duration
}

package agenttrace

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"crme/internal/authctx"
	"crme/internal/domain"
	"crme/internal/ports"
	"crme/internal/requestctx"
)

const (
	ContentNone     = "none"
	ContentMetadata = "metadata"
	ContentFull     = "full"
)

type LangSmith struct {
	APIKey      string
	Project     string
	Endpoint    string
	Environment string
	ContentMode string
	Client      *http.Client
}

func (l LangSmith) StartChat(ctx context.Context, input ports.AgentChatStart) ports.AgentTrace {
	id := newID()
	dottedOrder := dottedOrder(input.StartedAt, id)
	l.createRun(ctx, langsmithRun{
		ID:          id,
		TraceID:     id,
		DottedOrder: dottedOrder,
		Name:        "crme.assistant.chat",
		RunType:     "chain",
		StartTime:   input.StartedAt,
		Inputs:      l.chatInputs(ctx, input),
		Extra:       map[string]any{"metadata": l.metadata(ctx, id)},
		SessionName: l.Project,
	})
	return ports.AgentTrace{ID: id, DottedOrder: dottedOrder}
}

func (l LangSmith) EndChat(ctx context.Context, trace ports.AgentTrace, event ports.AgentChatEnd) {
	if trace.ID == "" {
		return
	}
	patch := map[string]any{
		"end_time": event.EndedAt.Format(time.RFC3339Nano),
		"outputs":  l.chatOutputs(event.Output),
	}
	if event.Error != nil {
		patch["error"] = event.Error.Error()
	}
	l.patchRun(ctx, trace.ID, patch)
}

func (l LangSmith) RecordLLM(ctx context.Context, trace ports.AgentTrace, event ports.AgentLLMEvent) {
	id := newID()
	l.createRun(ctx, langsmithRun{
		ID:          id,
		TraceID:     parentTraceID(trace, id),
		ParentRunID: trace.ID,
		DottedOrder: childDottedOrder(trace, event.StartedAt, id),
		Name:        "openrouter.chat.completions",
		RunType:     "llm",
		StartTime:   event.StartedAt,
		EndTime:     event.StartedAt.Add(event.Duration),
		Inputs:      l.llmInputs(event.Request),
		Outputs:     l.llmOutputs(event.Output),
		Error:       errorString(event.Error),
		Extra:       map[string]any{"metadata": mergeMetadata(l.metadata(ctx, trace.ID), map[string]any{"iteration": event.Iteration, "duration_ms": event.Duration.Milliseconds()})},
		SessionName: l.Project,
	})
}

func (l LangSmith) RecordTool(ctx context.Context, trace ports.AgentTrace, event ports.AgentToolEvent) {
	id := newID()
	l.createRun(ctx, langsmithRun{
		ID:          id,
		TraceID:     parentTraceID(trace, id),
		ParentRunID: trace.ID,
		DottedOrder: childDottedOrder(trace, event.StartedAt, id),
		Name:        event.Tool,
		RunType:     "tool",
		StartTime:   event.StartedAt,
		EndTime:     event.StartedAt.Add(event.Duration),
		Inputs:      l.toolInputs(event.Args),
		Outputs:     l.toolOutputs(event.Result),
		Error:       errorString(event.Error),
		Extra:       map[string]any{"metadata": mergeMetadata(l.metadata(ctx, trace.ID), map[string]any{"iteration": event.Iteration, "tool": event.Tool, "duration_ms": event.Duration.Milliseconds()})},
		SessionName: l.Project,
	})
}

func (l LangSmith) RecordAction(ctx context.Context, trace ports.AgentTrace, event ports.AgentActionEvent) {
	id := newID()
	name := "assistant.action.execute"
	if event.Command != "" {
		name = "assistant.action." + event.Command
	}
	l.createRun(ctx, langsmithRun{
		ID:          id,
		TraceID:     parentTraceID(trace, id),
		ParentRunID: trace.ID,
		DottedOrder: childDottedOrder(trace, event.StartedAt, id),
		Name:        name,
		RunType:     "tool",
		StartTime:   event.StartedAt,
		EndTime:     event.StartedAt.Add(event.Duration),
		Inputs:      l.actionInputs(event.Command, event.Args),
		Outputs:     l.valueOutputs(event.Result),
		Error:       errorString(event.Error),
		Extra:       map[string]any{"metadata": mergeMetadata(l.metadata(ctx, trace.ID), map[string]any{"command": event.Command, "duration_ms": event.Duration.Milliseconds()})},
		SessionName: l.Project,
	})
}

type langsmithRun struct {
	ID          string         `json:"id"`
	TraceID     string         `json:"trace_id,omitempty"`
	ParentRunID string         `json:"parent_run_id,omitempty"`
	DottedOrder string         `json:"dotted_order,omitempty"`
	Name        string         `json:"name"`
	RunType     string         `json:"run_type"`
	StartTime   time.Time      `json:"start_time"`
	EndTime     time.Time      `json:"end_time,omitempty"`
	Inputs      map[string]any `json:"inputs,omitempty"`
	Outputs     map[string]any `json:"outputs,omitempty"`
	Error       string         `json:"error,omitempty"`
	Extra       map[string]any `json:"extra,omitempty"`
	SessionName string         `json:"session_name,omitempty"`
}

func (l LangSmith) createRun(ctx context.Context, run langsmithRun) {
	l.send(ctx, http.MethodPost, "/runs", run)
}

func (l LangSmith) patchRun(ctx context.Context, id string, patch map[string]any) {
	l.send(ctx, http.MethodPatch, "/runs/"+id, patch)
}

func (l LangSmith) send(ctx context.Context, method, path string, payload any) {
	if strings.TrimSpace(l.APIKey) == "" {
		return
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return
	}
	endpoint := strings.TrimRight(l.Endpoint, "/")
	if endpoint == "" {
		endpoint = "https://api.smith.langchain.com"
	}
	client := l.Client
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(ctx, method, endpoint+path, bytes.NewReader(body))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-API-Key", l.APIKey)
		resp, err := client.Do(req)
		if err != nil {
			slog.DebugContext(ctx, "langsmith trace export failed", "error", err)
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode > 299 {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
			slog.WarnContext(ctx, "langsmith trace export rejected", "status", resp.Status, "body", string(body))
		}
	}()
}

func (l LangSmith) metadata(ctx context.Context, traceID string) map[string]any {
	out := map[string]any{"agent_trace_id": traceID}
	if requestID := requestctx.RequestID(ctx); requestID != "" {
		out["request_id"] = requestID
	}
	if sessionID := requestctx.SessionID(ctx); sessionID != "" {
		out["session_id"] = sessionID
	}
	if conversationID := requestctx.AssistantConversationID(ctx); conversationID != "" {
		out["conversation_id"] = conversationID
		out["thread_id"] = conversationID
	}
	if l.Environment != "" {
		out["environment"] = l.Environment
	}
	if access, ok := authctx.AccessFrom(ctx); ok {
		out["organization_id"] = string(access.OrganizationID)
		out["user_id"] = string(access.UserID)
		out["role"] = access.Role
	}
	return out
}

func (l LangSmith) mode() string {
	switch l.ContentMode {
	case ContentNone, ContentMetadata, ContentFull:
		return l.ContentMode
	default:
		return ContentMetadata
	}
}

func (l LangSmith) chatInputs(ctx context.Context, input ports.AgentChatStart) map[string]any {
	if l.mode() == ContentNone {
		return nil
	}
	conversationID := string(input.ConversationID)
	if conversationID == "" {
		conversationID = requestctx.AssistantConversationID(ctx)
	}
	return map[string]any{"message_count": input.MessageCount, "conversation_id": conversationID}
}

func (l LangSmith) chatOutputs(out domain.AICompletion) map[string]any {
	if l.mode() == ContentNone {
		return nil
	}
	if l.mode() == ContentMetadata {
		return map[string]any{"text_length": len(out.Text), "has_pending_action": out.PendingAction != nil, "entity_count": len(out.Entities)}
	}
	return map[string]any{"completion": redactAny(out)}
}

func (l LangSmith) llmInputs(req domain.AICompletionRequest) map[string]any {
	if l.mode() == ContentNone {
		return nil
	}
	if l.mode() == ContentMetadata {
		return map[string]any{"system_length": len(req.System), "message_count": len(req.Messages)}
	}
	return map[string]any{"request": redactAny(req)}
}

func (l LangSmith) llmOutputs(out domain.AICompletion) map[string]any {
	return l.chatOutputs(out)
}

func (l LangSmith) toolInputs(args map[string]any) map[string]any {
	if l.mode() == ContentNone {
		return nil
	}
	return map[string]any{"args": contentValue(l.mode(), args)}
}

func (l LangSmith) toolOutputs(result any) map[string]any {
	return l.valueOutputs(result)
}

func (l LangSmith) actionInputs(command string, args []string) map[string]any {
	if l.mode() == ContentNone {
		return nil
	}
	return map[string]any{"command": command, "args": contentValue(l.mode(), args)}
}

func (l LangSmith) valueOutputs(value any) map[string]any {
	if l.mode() == ContentNone {
		return nil
	}
	return map[string]any{"result": contentValue(l.mode(), value)}
}

func contentValue(mode string, value any) any {
	if mode == ContentFull {
		return redactAny(value)
	}
	return summarizeAny(value)
}

func summarizeAny(value any) any {
	if value == nil {
		return nil
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return map[string]any{"type": "unserializable"}
	}
	var decoded any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return map[string]any{"bytes": len(raw)}
	}
	switch v := decoded.(type) {
	case []any:
		return map[string]any{"type": "array", "count": len(v)}
	case map[string]any:
		return map[string]any{"type": "object", "field_count": len(v)}
	case string:
		return map[string]any{"type": "string", "length": len(v)}
	default:
		return map[string]any{"type": "scalar"}
	}
}

func redactAny(value any) any {
	raw, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	var decoded any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return nil
	}
	return redactDecoded(decoded)
}

func redactDecoded(value any) any {
	switch v := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(v))
		for key, item := range v {
			if sensitiveKey(key) {
				out[key] = "[redacted]"
				continue
			}
			out[key] = redactDecoded(item)
		}
		return out
	case []any:
		out := make([]any, 0, len(v))
		for _, item := range v {
			out = append(out, redactDecoded(item))
		}
		return out
	case string:
		if len(v) > 12000 {
			return v[:12000] + "…[truncated]"
		}
		return v
	default:
		return v
	}
}

func sensitiveKey(key string) bool {
	key = strings.ToLower(key)
	return strings.Contains(key, "password") || strings.Contains(key, "secret") || strings.Contains(key, "token") || strings.Contains(key, "api_key") || strings.Contains(key, "apikey")
}

func mergeMetadata(base, extra map[string]any) map[string]any {
	out := map[string]any{}
	for k, v := range base {
		out[k] = v
	}
	for k, v := range extra {
		out[k] = v
	}
	return out
}

func errorString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func parentTraceID(trace ports.AgentTrace, fallback string) string {
	if trace.ID != "" {
		return trace.ID
	}
	return fallback
}

func childDottedOrder(trace ports.AgentTrace, t time.Time, id string) string {
	current := dottedOrder(t, id)
	if trace.DottedOrder == "" {
		return current
	}
	return trace.DottedOrder + "." + current
}

func dottedOrder(t time.Time, id string) string {
	t = t.UTC()
	return t.Format("20060102T150405") + fmt.Sprintf("%06dZ", t.Nanosecond()/1000) + id
}

func newID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return hex.EncodeToString([]byte(time.Now().Format("20060102150405.000000000")))[:32]
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return hex.EncodeToString(b[0:4]) + "-" + hex.EncodeToString(b[4:6]) + "-" + hex.EncodeToString(b[6:8]) + "-" + hex.EncodeToString(b[8:10]) + "-" + hex.EncodeToString(b[10:16])
}

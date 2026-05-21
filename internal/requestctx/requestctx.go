package requestctx

import "context"

type key struct{}
type sessionKey struct{}
type assistantConversationKey struct{}

func WithRequestID(ctx context.Context, requestID string) context.Context {
	if requestID == "" {
		return ctx
	}
	return context.WithValue(ctx, key{}, requestID)
}

func RequestID(ctx context.Context) string {
	requestID, _ := ctx.Value(key{}).(string)
	return requestID
}

func WithSessionID(ctx context.Context, sessionID string) context.Context {
	if sessionID == "" {
		return ctx
	}
	return context.WithValue(ctx, sessionKey{}, sessionID)
}

func SessionID(ctx context.Context) string {
	sessionID, _ := ctx.Value(sessionKey{}).(string)
	return sessionID
}

func WithAssistantConversationID(ctx context.Context, conversationID string) context.Context {
	if conversationID == "" {
		return ctx
	}
	return context.WithValue(ctx, assistantConversationKey{}, conversationID)
}

func AssistantConversationID(ctx context.Context) string {
	conversationID, _ := ctx.Value(assistantConversationKey{}).(string)
	return conversationID
}

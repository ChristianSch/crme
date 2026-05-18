package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"crme/internal/domain"
)

type OpenRouter struct {
	APIKey string
	Model  string
	Client *http.Client
}

func (o OpenRouter) Complete(ctx context.Context, req domain.AICompletionRequest) (domain.AICompletion, error) {
	if o.APIKey == "" {
		return domain.AICompletion{}, fmt.Errorf("OPENROUTER_API_KEY is not set")
	}
	model := o.Model
	if model == "" {
		model = "openai/gpt-4o-mini"
	}
	messages := make([]map[string]string, 0, len(req.Messages)+1)
	if req.System != "" {
		messages = append(messages, map[string]string{"role": "system", "content": req.System})
	}
	for _, m := range req.Messages {
		messages = append(messages, map[string]string{"role": m.Role, "content": m.Content})
	}
	body, _ := json.Marshal(map[string]any{"model": model, "messages": messages})
	hreq, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://openrouter.ai/api/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return domain.AICompletion{}, err
	}
	hreq.Header.Set("Authorization", "Bearer "+o.APIKey)
	hreq.Header.Set("Content-Type", "application/json")
	hreq.Header.Set("HTTP-Referer", "https://github.com/local/crme")
	hreq.Header.Set("X-Title", "crme")
	client := o.Client
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	resp, err := client.Do(hreq)
	if err != nil {
		return domain.AICompletion{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return domain.AICompletion{}, fmt.Errorf("openrouter status %s", resp.Status)
	}
	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return domain.AICompletion{}, err
	}
	if len(out.Choices) == 0 {
		return domain.AICompletion{}, fmt.Errorf("openrouter returned no choices")
	}
	return domain.AICompletion{Text: out.Choices[0].Message.Content}, nil
}

package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"text/tabwriter"
	"time"

	"crme/internal/adapters/ai"
	"crme/internal/domain"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	base := getenv("CRME_API", "http://localhost:8080")
	client := &http.Client{Timeout: 30 * time.Second}
	cmd := os.Args[1]
	args, jsonOut := parseGlobalArgs(os.Args[2:])
	if cmd == "chat" {
		runChat(args)
		return
	}
	var method, path string
	var body []byte
	switch cmd {
	case "magic-link":
		method, path, body = http.MethodPost, "/auth/magic-link", magicLinkBody(args)
	case "people":
		method, path = http.MethodGet, "/people"+query(args)
	case "person-create":
		method, path, body = http.MethodPost, "/people", stdinOrPairs(args)
	case "person-get":
		method, path = http.MethodGet, "/people/"+arg(args, "id")
	case "person-update":
		method, path, body = http.MethodPut, "/people/"+arg(args, "id"), stdinOrPairs(args)
	case "person-delete":
		method, path = http.MethodDelete, "/people/"+arg(args, "id")
	case "companies":
		method, path = http.MethodGet, "/companies"+query(args)
	case "company-create":
		method, path, body = http.MethodPost, "/companies", stdinOrPairs(args)
	case "company-get":
		method, path = http.MethodGet, "/companies/"+arg(args, "id")
	case "company-update":
		method, path, body = http.MethodPut, "/companies/"+arg(args, "id"), stdinOrPairs(args)
	case "company-delete":
		method, path = http.MethodDelete, "/companies/"+arg(args, "id")
	case "deals":
		method, path = http.MethodGet, "/deals"+query(args)
	case "deal-create":
		method, path, body = http.MethodPost, "/deals", stdinOrPairs(args)
	case "deal-get":
		method, path = http.MethodGet, "/deals/"+arg(args, "id")
	case "deal-update":
		method, path, body = http.MethodPut, "/deals/"+arg(args, "id"), stdinOrPairs(args)
	case "deal-delete":
		method, path = http.MethodDelete, "/deals/"+arg(args, "id")
	case "link-person-company":
		method, path, body = http.MethodPost, "/relationships/person-company", stdinOrPairs(args)
	case "unlink-person-company":
		method, path, body = http.MethodDelete, "/relationships/person-company", stdinOrPairs(args)
	case "link-deal-person":
		method, path, body = http.MethodPost, "/relationships/deal-person", stdinOrPairs(args)
	case "unlink-deal-person":
		method, path, body = http.MethodDelete, "/relationships/deal-person", stdinOrPairs(args)
	case "link-deal-company":
		method, path, body = http.MethodPost, "/relationships/deal-company", stdinOrPairs(args)
	case "unlink-deal-company":
		method, path, body = http.MethodDelete, "/relationships/deal-company", stdinOrPairs(args)
	case "activity-create":
		method, path, body = http.MethodPost, "/activities", stdinOrPairs(args)
	case "activity-update":
		method, path, body = http.MethodPut, "/activities/"+arg(args, "id"), stdinOrPairs(args)
	case "activity-delete":
		method, path = http.MethodDelete, "/activities/"+arg(args, "id")
	case "note-update":
		method, path, body = http.MethodPut, "/notes/"+arg(args, "id"), stdinOrPairs(args)
	case "note-delete":
		method, path = http.MethodDelete, "/notes/"+arg(args, "id")
	case "timeline":
		method, path = http.MethodGet, "/timeline/"+arg(args, "entity_type")+"/"+arg(args, "entity_id")+query(args)
	case "search":
		method, path = http.MethodGet, "/search"+query(args)
	case "tags":
		method, path = http.MethodGet, "/tags"+query(args)
	case "tag-create":
		method, path, body = http.MethodPost, "/tags", stdinOrPairs(args)
	case "tag-attach":
		method, path, body = http.MethodPost, "/tags/attach", stdinOrPairs(args)
	case "workspaces":
		method, path = http.MethodGet, "/workspaces"+query(args)
	case "workspace-create":
		method, path, body = http.MethodPost, "/workspaces", stdinOrPairs(args)
	case "workspace-entities":
		method, path = http.MethodGet, "/workspaces/"+arg(args, "id")+"/entities"+query(args)
	case "workspace-link":
		method, path, body = http.MethodPost, "/workspaces/link", stdinOrPairs(args)
	case "tasks":
		method, path = http.MethodGet, "/dashboard/action-items"+query(args)
	case "task-create":
		method, path, body = http.MethodPost, "/tasks", stdinOrPairs(args)
	case "task-update":
		method, path, body = http.MethodPut, "/tasks/"+arg(args, "id"), stdinOrPairs(args)
	case "task-complete":
		method, path, body = http.MethodPost, "/tasks/"+arg(args, "id")+"/complete", []byte(`{}`)
	case "task-delete":
		method, path = http.MethodDelete, "/tasks/"+arg(args, "id")
	case "dashboard":
		method, path = http.MethodGet, "/dashboard/action-items"+query(args)
	case "email-accounts":
		method, path = http.MethodGet, "/email/accounts"+query(args)
	case "email-account-create":
		method, path, body = http.MethodPost, "/email/accounts", stdinOrPairs(args)
	case "email-sync":
		method, path, body = http.MethodPost, "/email/sync"+query(args), []byte(`{}`)
	case "suggestions":
		method, path = http.MethodGet, "/ai/prompts"+query(args)
	case "suggestion-create":
		method, path, body = http.MethodPost, "/ai/prompts", stdinOrPairs(args)
	case "suggestion-accept":
		method, path, body = http.MethodPost, "/ai/prompts/accept", stdinOrPairs(args)
	case "suggestion-link-person":
		method, path, body = http.MethodPost, "/ai/prompts/link-person", stdinOrPairs(args)
	case "suggestion-link-company":
		method, path, body = http.MethodPost, "/ai/prompts/link-company", stdinOrPairs(args)
	case "suggestion-dismiss":
		method, path, body = http.MethodPost, "/ai/prompts/resolve", suggestionDismissBody(args)
	case "suggestion-suppress":
		method, path, body = http.MethodPost, "/ai/prompts/resolve", suggestionSuppressBody(args)
	default:
		usage()
		os.Exit(2)
	}
	req, err := http.NewRequest(method, strings.TrimRight(base, "/")+path, bytes.NewReader(body))
	if err != nil {
		fatal(err)
	}
	if len(body) > 0 {
		req.Header.Set("Content-Type", "application/json")
	}
	if session := os.Getenv("CRME_SESSION"); session != "" {
		req.Header.Set("X-CRM-Session", session)
	}
	resp, err := client.Do(req)
	if err != nil {
		fatal(err)
	}
	defer resp.Body.Close()
	out, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		fmt.Fprint(os.Stderr, string(out))
		os.Exit(1)
	}
	printOutput(cmd, out, jsonOut)
}

func usage() {
	fmt.Fprintln(os.Stderr, `usage: crmctl <command> [--json] [key=value...]

CRME_API defaults to http://localhost:8080. POST commands accept JSON on stdin or key=value pairs.
Default output is a readable table/key-value view. Use --json for raw API JSON.

commands:
  chat
  magic-link email=you@example.com
  people [q=... limit=...] | person-get id=<uuid> | person-create [workspace_id=<uuid>] ... | person-update id=<uuid> ... | person-delete id=<uuid>
  companies | company-get id=<uuid> | company-create [workspace_id=<uuid>] ... | company-update id=<uuid> ... | company-delete id=<uuid>
  deals | deal-get id=<uuid> | deal-create ... | deal-update id=<uuid> ... | deal-delete id=<uuid>
  link-person-company person_id=<uuid> company_id=<uuid> role=buyer | unlink-person-company person_id=<uuid> company_id=<uuid>
  link-deal-person deal_id=<uuid> person_id=<uuid> | unlink-deal-person deal_id=<uuid> person_id=<uuid> | link-deal-company deal_id=<uuid> company_id=<uuid> | unlink-deal-company deal_id=<uuid> company_id=<uuid>
  activity-create '{"activity":{"type":"note","body":"..."},"links":[...]}' | activity-update id=<uuid> type=note body=... occurred_at=... | activity-delete id=<uuid> | note-update id=<uuid> body=... occurred_at=... | note-delete id=<uuid>
  timeline entity_type=person entity_id=<uuid> | search q=ada
  tags | tag-create name=Important color=red | tag-attach tag_id=<uuid> entity_type=person entity_id=<uuid>
  workspaces | workspace-create name=... description=... | workspace-entities id=<uuid> [entity_type=person|company|deal|task]
  workspace-link workspace_id=<uuid> entity_type=person|company|deal|task entity_id=<uuid>
  tasks | task-create workspace_id=<uuid> entity_type=person entity_id=<uuid> title="Follow up" due=end-of-may | task-update id=<uuid> due=tomorrow | task-complete id=<uuid> | task-delete id=<uuid>
  dashboard
  email-accounts | email-account-create name=Work email=me@example.com imap_host=... smtp_host=... secret=...
  email-sync [limit=...]
  suggestions [status=open] | suggestion-create kind=follow_up entity_type=person entity_id=<uuid> context="..."
  suggestion-accept id=<uuid> | suggestion-link-person id=<uuid> person_id=<uuid> | suggestion-link-company id=<uuid> company_id=<uuid>
  suggestion-dismiss id=<uuid> | suggestion-suppress id=<uuid>`)
}

var chatInput *bufio.Reader

func runChat(args []string) {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		fatal(fmt.Errorf("OPENROUTER_API_KEY is required for chat"))
	}
	model := getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
	assistant := ai.OpenRouter{APIKey: apiKey, Model: model}
	chatInput = bufio.NewReader(os.Stdin)
	history := []domain.AIMessage{}
	fmt.Printf("crme chat (%s). Type exit to quit.\n", model)
	for {
		fmt.Print("> ")
		line, err := chatInput.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			fatal(err)
		}
		input := strings.TrimSpace(line)
		if input == "" {
			continue
		}
		if input == "exit" || input == "quit" {
			break
		}
		history = append(history, domain.AIMessage{Role: "user", Content: input})
		answer, updated, err := chatTurn(context.Background(), assistant, history)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			continue
		}
		history = append(updated, domain.AIMessage{Role: "assistant", Content: answer})
		fmt.Println(answer)
	}
}

func chatTurn(ctx context.Context, assistant ai.OpenRouter, history []domain.AIMessage) (string, []domain.AIMessage, error) {
	messages := append([]domain.AIMessage(nil), history...)
	for i := 0; i < 10; i++ {
		completion, err := assistant.Complete(ctx, domain.AICompletionRequest{System: chatSystemPrompt(), Messages: messages})
		if err != nil {
			return "", history, err
		}
		resp, err := parseChatResponse(completion.Text)
		if err != nil {
			return strings.TrimSpace(completion.Text), messages, nil
		}
		if resp.Type == "final" {
			return resp.Message, messages, nil
		}
		if resp.Type != "command" {
			return "", history, fmt.Errorf("unknown chat response type %q", resp.Type)
		}
		out, err := runCRMCTLCommand(ctx, resp.Command, resp.Args)
		if err != nil {
			out = "ERROR: " + err.Error() + "\n" + out
		}
		requestJSON, _ := json.Marshal(resp)
		messages = append(messages,
			domain.AIMessage{Role: "assistant", Content: string(requestJSON)},
			domain.AIMessage{Role: "user", Content: "crmctl output:\n" + truncate(out, 6000)},
		)
	}
	return "", history, fmt.Errorf("chat exceeded command limit")
}

type chatResponse struct {
	Type    string   `json:"type"`
	Message string   `json:"message"`
	Command string   `json:"command"`
	Args    []string `json:"args"`
	Reason  string   `json:"reason"`
}

func parseChatResponse(s string) (chatResponse, error) {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	s = strings.TrimSpace(s)
	var resp chatResponse
	if err := json.Unmarshal([]byte(s), &resp); err == nil {
		return resp, nil
	}
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start >= 0 && end > start {
		err := json.Unmarshal([]byte(s[start:end+1]), &resp)
		return resp, err
	}
	return resp, fmt.Errorf("response did not contain a JSON object")
}

func runCRMCTLCommand(ctx context.Context, command string, args []string) (string, error) {
	if !allowedChatCommands()[command] {
		return "", fmt.Errorf("command %q is not allowed in chat", command)
	}
	if mutatingChatCommands()[command] && !confirmCommand(command, args) {
		return "", fmt.Errorf("command cancelled")
	}
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	cmdArgs := []string{command, "--json"}
	for _, a := range args {
		if a != "--json" {
			cmdArgs = append(cmdArgs, a)
		}
	}
	cmdCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(cmdCtx, exe, cmdArgs...)
	cmd.Env = os.Environ()
	out, err := cmd.CombinedOutput()
	if cmdCtx.Err() == context.DeadlineExceeded {
		return string(out), fmt.Errorf("command timed out")
	}
	return string(out), err
}

func confirmCommand(command string, args []string) bool {
	fmt.Fprintln(os.Stderr)
	fmt.Fprintln(os.Stderr, "────────────────────────────────────────")
	fmt.Fprintf(os.Stderr, "Confirm CRM change: %s\n", command)
	for _, a := range args {
		fmt.Fprintf(os.Stderr, "  %s\n", formatConfirmArg(a))
	}
	fmt.Fprintln(os.Stderr, "────────────────────────────────────────")
	fmt.Fprint(os.Stderr, "Run this change? [y/N] ")
	reader := chatInput
	if reader == nil {
		reader = bufio.NewReader(os.Stdin)
	}
	line, _ := reader.ReadString('\n')
	line = strings.ToLower(strings.TrimSpace(line))
	return line == "y" || line == "yes"
}

func formatConfirmArg(arg string) string {
	key, value, ok := strings.Cut(arg, "=")
	if !ok {
		return truncate(arg, 160)
	}
	return key + " = " + truncate(value, 220)
}

func allowedChatCommands() map[string]bool {
	return map[string]bool{
		"people": true, "person-get": true, "person-create": true, "person-update": true, "person-delete": true,
		"companies": true, "company-get": true, "company-create": true, "company-update": true, "company-delete": true,
		"deals": true, "deal-get": true, "deal-create": true, "deal-update": true, "deal-delete": true,
		"link-person-company": true, "unlink-person-company": true, "link-deal-person": true, "unlink-deal-person": true, "link-deal-company": true, "unlink-deal-company": true,
		"activity-create": true, "activity-update": true, "activity-delete": true, "note-update": true, "note-delete": true, "timeline": true, "search": true,
		"tags": true, "tag-create": true, "tag-attach": true,
		"workspaces": true, "workspace-create": true, "workspace-entities": true, "workspace-link": true,
		"tasks": true, "task-create": true, "task-update": true, "task-complete": true, "task-delete": true, "dashboard": true,
		"email-accounts": true, "email-sync": true,
		"suggestions": true, "suggestion-create": true, "suggestion-accept": true,
		"suggestion-link-person": true, "suggestion-link-company": true, "suggestion-dismiss": true, "suggestion-suppress": true,
	}
}

func mutatingChatCommands() map[string]bool {
	return map[string]bool{
		"person-create": true, "person-update": true, "person-delete": true,
		"company-create": true, "company-update": true, "company-delete": true,
		"deal-create": true, "deal-update": true, "deal-delete": true,
		"link-person-company": true, "unlink-person-company": true, "link-deal-person": true, "unlink-deal-person": true, "link-deal-company": true, "unlink-deal-company": true,
		"activity-create": true, "activity-update": true, "activity-delete": true, "note-update": true, "note-delete": true, "tag-create": true, "tag-attach": true,
		"workspace-create": true, "workspace-link": true,
		"task-create": true, "task-update": true, "task-complete": true, "task-delete": true,
		"email-sync":        true,
		"suggestion-create": true, "suggestion-accept": true,
		"suggestion-link-person": true, "suggestion-link-company": true, "suggestion-dismiss": true, "suggestion-suppress": true,
	}
}

func chatSystemPrompt() string {
	return `You are crme's CLI chat assistant. Help the user inspect and update CRM data by using crmctl commands.

Respond with exactly one JSON object and no prose. Do not explain what you are about to do outside the JSON.
For a normal answer: {"type":"final","message":"..."}
To run a command: {"type":"command","command":"search","args":["q=ada"],"reason":"..."}

Use commands only when needed. Prefer search first when the user names a person, company, or deal but does not provide an id. Do not include --json; it is added automatically.
When you receive crmctl output, base your answer strictly on that output. If a tasks command returns a non-empty JSON array, summarize those tasks; never say there are no tasks unless the command output is exactly an empty array or an explicit no-rows response.
Available commands:
people [q=... limit=...], person-get id=..., person-create key=value..., person-update id=... key=value..., person-delete id=...
companies [q=... limit=...], company-get id=..., company-create key=value..., company-update id=... key=value..., company-delete id=...
deals [limit=...], deal-get id=..., deal-create workspace_id=... key=value..., deal-update id=... workspace_id=... key=value..., deal-delete id=...
link-person-company person_id=... company_id=..., unlink-person-company person_id=... company_id=..., link-deal-person deal_id=... person_id=..., unlink-deal-person deal_id=... person_id=..., link-deal-company deal_id=... company_id=..., unlink-deal-company deal_id=... company_id=...
workspaces, workspace-create name=... description=..., workspace-entities id=... [entity_type=person|company|deal|task], workspace-link workspace_id=... entity_type=person|company|deal|task entity_id=...
search q=..., timeline entity_type=person|company|deal entity_id=... [limit=...]
activity-create {json}, activity-update id=... type=note|call|meeting|email body=... occurred_at=..., activity-delete id=..., note-update id=... body=... occurred_at=..., note-delete id=...
tasks, task-create workspace_id=... entity_type=... entity_id=... title=... body=... due_at=2026-05-31T17:00:00Z, task-update id=... due=tomorrow title=... body=..., task-complete id=..., task-delete id=..., dashboard
For task dates, use due_at=<RFC3339>, due=2026-05-31, due=tomorrow, due="in 2.5 weeks", or due=end-of-may.
suggestions [status=open], suggestion-accept id=..., suggestion-dismiss id=..., suggestion-suppress id=..., suggestion-link-person id=..., suggestion-link-company id=...
email-accounts, email-sync [limit=...]
Mutating commands require user confirmation before execution.`
}

func parseGlobalArgs(args []string) ([]string, bool) {
	out := make([]string, 0, len(args))
	jsonOut := false
	for _, a := range args {
		if a == "--json" {
			jsonOut = true
			continue
		}
		out = append(out, a)
	}
	return out, jsonOut
}

func printOutput(cmd string, out []byte, jsonOut bool) {
	if jsonOut {
		fmt.Print(string(out))
		return
	}
	var v any
	if err := json.Unmarshal(out, &v); err != nil {
		fmt.Print(string(out))
		return
	}
	if rows, ok := v.([]any); ok {
		printRows(cmd, rows)
		return
	}
	if obj, ok := v.(map[string]any); ok {
		printObject(obj)
		return
	}
	fmt.Print(string(out))
}

func printRows(cmd string, rows []any) {
	if len(rows) == 0 {
		fmt.Println("No rows.")
		return
	}
	cols := columnsFor(cmd)
	if len(cols) == 0 {
		if obj, ok := rows[0].(map[string]any); ok {
			for k := range obj {
				cols = append(cols, k)
			}
		}
	}
	tw := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, strings.Join(cols, "\t"))
	for _, r := range rows {
		obj, ok := r.(map[string]any)
		if !ok {
			fmt.Fprintln(tw, r)
			continue
		}
		vals := make([]string, 0, len(cols))
		for _, c := range cols {
			if c == "name" && obj[c] == nil {
				vals = append(vals, strings.TrimSpace(formatValue("first_name", obj["first_name"])+" "+formatValue("last_name", obj["last_name"])))
				continue
			}
			vals = append(vals, formatValue(c, obj[c]))
		}
		fmt.Fprintln(tw, strings.Join(vals, "\t"))
	}
	tw.Flush()
}

func printObject(obj map[string]any) {
	// Common tiny status responses stay compact.
	if len(obj) == 1 {
		for k, v := range obj {
			fmt.Printf("%s: %s\n", k, formatValue(k, v))
		}
		return
	}
	tw := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	for _, k := range preferredObjectKeys(obj) {
		fmt.Fprintf(tw, "%s\t%s\n", k, formatValue(k, obj[k]))
	}
	tw.Flush()
}

func columnsFor(cmd string) []string {
	switch cmd {
	case "people":
		return []string{"id", "name", "email", "linkedin_url", "city", "status", "source", "last_touch_at"}
	case "companies":
		return []string{"id", "name", "domain", "last_touch_at"}
	case "deals":
		return []string{"id", "workspace_id", "name", "stage", "value_cents", "currency"}
	case "dashboard", "tasks":
		return []string{"id", "workspace_id", "title", "body", "status", "due_at"}
	case "search":
		return []string{"entity_type", "title", "subtitle", "entity_id"}
	case "tags":
		return []string{"id", "name", "color"}
	case "workspaces":
		return []string{"id", "name", "description", "updated_at"}
	case "workspace-entities":
		return []string{"entity_type", "title", "subtitle", "entity_id"}
	case "email-accounts":
		return []string{"id", "name", "email", "imap_host", "smtp_host", "sync_enabled"}
	case "suggestions":
		return []string{"id", "kind", "title", "status", "created_at"}
	default:
		return nil
	}
}

func preferredObjectKeys(obj map[string]any) []string {
	preferred := []string{"id", "workspace_id", "session_id", "status", "first_name", "last_name", "name", "description", "email", "phone", "title", "linkedin_url", "body", "due_at", "city", "stage", "value_cents", "currency", "domain", "created_at", "updated_at"}
	seen := map[string]bool{}
	out := []string{}
	for _, k := range preferred {
		if _, ok := obj[k]; ok {
			out = append(out, k)
			seen[k] = true
		}
	}
	for k := range obj {
		if !seen[k] {
			out = append(out, k)
		}
	}
	return out
}

func formatValue(key string, v any) string {
	if v == nil {
		return ""
	}
	switch x := v.(type) {
	case string:
		return truncate(x, 72)
	case float64:
		if x == float64(int64(x)) {
			return fmt.Sprintf("%d", int64(x))
		}
		return fmt.Sprintf("%g", x)
	case bool:
		return fmt.Sprint(x)
	default:
		b, _ := json.Marshal(x)
		return truncate(string(b), 72)
	}
}

func truncate(s string, n int) string {
	s = strings.ReplaceAll(s, "\n", " ")
	if len(s) <= n {
		return s
	}
	if n <= 1 {
		return s[:n]
	}
	return s[:n-1] + "…"
}

func suggestionDismissBody(args []string) []byte {
	for _, a := range args {
		if strings.HasPrefix(a, "status=") {
			return stdinOrPairs(args)
		}
	}
	args = append(args, "status=dismissed")
	return stdinOrPairs(args)
}

func suggestionSuppressBody(args []string) []byte {
	args = append(args, "status=dismissed", "suppress=true")
	return stdinOrPairs(args)
}

func magicLinkBody(args []string) []byte {
	if len(args) == 1 && !strings.Contains(args[0], "=") {
		b, _ := json.Marshal(map[string]any{"email": args[0]})
		return b
	}
	return stdinOrPairs(args)
}

func stdinOrPairs(args []string) []byte {
	if len(args) == 1 && strings.HasPrefix(strings.TrimSpace(args[0]), "{") {
		return []byte(args[0])
	}
	st, _ := os.Stdin.Stat()
	if st != nil && (st.Mode()&os.ModeCharDevice) == 0 {
		b, _ := io.ReadAll(os.Stdin)
		return b
	}
	m := map[string]any{}
	for _, a := range args {
		k, v, ok := strings.Cut(a, "=")
		if !ok {
			continue
		}
		if k == "due" {
			k = "due_at"
		}
		m[k] = coerceKey(k, v)
	}
	b, _ := json.Marshal(m)
	return b
}

func arg(args []string, key string) string {
	for _, a := range args {
		k, v, ok := strings.Cut(a, "=")
		if ok && k == key {
			return v
		}
	}
	return ""
}

func query(args []string) string {
	if len(args) == 0 {
		return ""
	}
	parts := make([]string, 0, len(args))
	for _, a := range args {
		if strings.Contains(a, "=") {
			parts = append(parts, a)
		}
	}
	if len(parts) == 0 {
		return ""
	}
	return "?" + strings.Join(parts, "&")
}

func coerceKey(k, v string) any {
	if k == "due_at" {
		if parsed, ok := parseDue(v); ok {
			return parsed
		}
	}
	return coerce(v)
}

func coerce(v string) any {
	if v == "true" {
		return true
	}
	if v == "false" {
		return false
	}
	var i int64
	if _, err := fmt.Sscan(v, &i); err == nil && fmt.Sprint(i) == v {
		return i
	}
	return v
}

func parseDue(v string) (string, bool) {
	s := strings.ToLower(strings.TrimSpace(v))
	s = strings.ReplaceAll(s, "_", "-")
	loc := time.Local
	now := time.Now().In(loc)
	if t, err := time.Parse(time.RFC3339, v); err == nil {
		return t.Format(time.RFC3339), true
	}
	if t, err := time.ParseInLocation("2006-01-02", v, loc); err == nil {
		return dueTime(t, loc).Format(time.RFC3339), true
	}
	switch s {
	case "today":
		return dueTime(now, loc).Format(time.RFC3339), true
	case "tomorrow":
		return dueTime(now.AddDate(0, 0, 1), loc).Format(time.RFC3339), true
	case "eom", "end-of-month", "end-of-this-month":
		return endOfMonth(now.Year(), now.Month(), loc).Format(time.RFC3339), true
	case "end-of-may", "end-of-may-2026":
		year := now.Year()
		if now.Month() > time.May {
			year++
		}
		return endOfMonth(year, time.May, loc).Format(time.RFC3339), true
	}
	var amount float64
	var unit string
	if _, err := fmt.Sscanf(s, "in %f %s", &amount, &unit); err == nil {
		days := 0.0
		switch strings.TrimSuffix(unit, "s") {
		case "day", "d":
			days = amount
		case "week", "w":
			days = amount * 7
		}
		if days > 0 {
			return now.Add(time.Duration(days * float64(24*time.Hour))).Format(time.RFC3339), true
		}
	}
	return "", false
}

func dueTime(t time.Time, loc *time.Location) time.Time {
	return time.Date(t.In(loc).Year(), t.In(loc).Month(), t.In(loc).Day(), 17, 0, 0, 0, loc)
}

func endOfMonth(year int, month time.Month, loc *time.Location) time.Time {
	firstNext := time.Date(year, month+1, 1, 17, 0, 0, 0, loc)
	return firstNext.AddDate(0, 0, -1)
}
func getenv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }

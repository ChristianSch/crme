package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"text/tabwriter"
	"time"

	"crme/internal/domain"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	base := apiBase()
	client := &http.Client{Timeout: 30 * time.Second}
	cmd := os.Args[1]
	args, jsonOut := parseGlobalArgs(os.Args[2:])
	if cmd == "chat" {
		runChat(base, client)
		return
	}
	if cmd == "auth" {
		runAuth(args, base)
		return
	}
	var method, path string
	var body []byte
	switch cmd {
	case "magic-link":
		method, path, body = http.MethodPost, "/auth/magic-link", magicLinkBody(args)
	case "me":
		method, path = http.MethodGet, "/me"+query(args)
	case "capabilities":
		method, path = http.MethodGet, "/capabilities"+query(args)
	case "organizations":
		method, path = http.MethodGet, "/organizations"+query(args)
	case "organization-create":
		method, path, body = http.MethodPost, "/organizations", stdinOrPairs(args)
	case "organization-members":
		method, path = http.MethodGet, "/organizations/"+arg(args, "id")+"/members"+queryExcept(args, "id")
	case "organization-member-update":
		method, path, body = http.MethodPatch, "/organizations/"+arg(args, "id")+"/members/"+arg(args, "user_id"), stdinOrPairs(args)
	case "organization-member-remove":
		method, path = http.MethodDelete, "/organizations/"+arg(args, "id")+"/members/"+arg(args, "user_id")
	case "organization-invitations":
		method, path = http.MethodGet, "/organizations/"+arg(args, "id")+"/invitations"+queryExcept(args, "id")
	case "organization-invite":
		method, path, body = http.MethodPost, "/organizations/"+arg(args, "id")+"/invitations", stdinOrPairs(args)
	case "organization-invitation-resend":
		method, path, body = http.MethodPost, "/organizations/"+arg(args, "id")+"/invitations/"+arg(args, "invitation_id")+"/resend", []byte(`{}`)
	case "invitation-get":
		method, path = http.MethodGet, "/invitations/"+arg(args, "token")
	case "invitation-accept":
		method, path, body = http.MethodPost, "/invitations/"+arg(args, "token")+"/accept", []byte(`{}`)
	case "people":
		method, path = http.MethodGet, "/people"+query(args)
	case "person-create":
		method, path, body = http.MethodPost, "/people", stdinOrPairs(args)
	case "person-get":
		method, path = http.MethodGet, "/people/"+arg(args, "id")
	case "person-companies":
		method, path = http.MethodGet, "/people/"+arg(args, "id")+"/companies"+queryExcept(args, "id")
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
	case "company-people":
		method, path = http.MethodGet, "/companies/"+arg(args, "id")+"/people"+queryExcept(args, "id")
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
	case "deal-people":
		method, path = http.MethodGet, "/deals/"+arg(args, "id")+"/people"+queryExcept(args, "id")
	case "deal-companies":
		method, path = http.MethodGet, "/deals/"+arg(args, "id")+"/companies"+queryExcept(args, "id")
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
	case "notes":
		method, path = http.MethodGet, "/notes"+query(args)
	case "activity-update":
		method, path, body = http.MethodPut, "/activities/"+arg(args, "id"), stdinOrPairs(args)
	case "activity-delete":
		method, path = http.MethodDelete, "/activities/"+arg(args, "id")
	case "note-update":
		method, path, body = http.MethodPut, "/notes/"+arg(args, "id"), stdinOrPairs(args)
	case "note-delete":
		method, path = http.MethodDelete, "/notes/"+arg(args, "id")
	case "timeline":
		method, path = http.MethodGet, "/timeline/"+arg(args, "entity_type")+"/"+arg(args, "entity_id")+queryExcept(args, "entity_type", "entity_id")
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
		method, path = http.MethodGet, "/workspaces/"+arg(args, "id")+"/entities"+queryExcept(args, "id")
	case "workspace-link":
		method, path, body = http.MethodPost, "/workspaces/link", stdinOrPairs(args)
	case "tasks":
		method, path = http.MethodGet, "/tasks"+query(args)
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
	case "email-account-test":
		method, path, body = http.MethodPost, "/email/accounts/test", stdinOrPairs(args)
	case "email-account-update":
		method, path, body = http.MethodPatch, "/email/accounts/"+arg(args, "id"), stdinOrPairs(args)
	case "email-account-delete":
		method, path = http.MethodDelete, "/email/accounts/"+arg(args, "id")
	case "email-sync":
		method, path, body = http.MethodPost, "/email/sync"+query(args), []byte(`{}`)
	case "assistant-conversations":
		method, path = http.MethodGet, "/ai/conversations"+query(args)
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
	case "audit-logs":
		method, path = http.MethodGet, "/audit-logs"+query(args)
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
	setAuthHeaders(req, base)
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
  auth set [--api <url>] <api-token> | auth show | auth clear
  magic-link email=you@example.com | me | capabilities
  organizations | organization-create name=... | organization-members id=<org> | organization-member-update id=<org> user_id=<user> role=admin | organization-member-remove id=<org> user_id=<user>
  organization-invitations id=<org> | organization-invite id=<org> email=... role=member | organization-invitation-resend id=<org> invitation_id=<uuid> | invitation-get token=... | invitation-accept token=...
  people [q=... limit=...] | person-get id=<uuid> | person-companies id=<uuid> | person-create [workspace_id=<uuid>] ... | person-update id=<uuid> ... | person-delete id=<uuid>
  companies | company-get id=<uuid> | company-people id=<uuid> | company-create [workspace_id=<uuid>] ... | company-update id=<uuid> ... | company-delete id=<uuid>
  deals | deal-get id=<uuid> | deal-people id=<uuid> | deal-companies id=<uuid> | deal-create ... | deal-update id=<uuid> ... | deal-delete id=<uuid>
  link-person-company person_id=<uuid> company_id=<uuid> role=buyer | unlink-person-company person_id=<uuid> company_id=<uuid>
  link-deal-person deal_id=<uuid> person_id=<uuid> | unlink-deal-person deal_id=<uuid> person_id=<uuid> | link-deal-company deal_id=<uuid> company_id=<uuid> | unlink-deal-company deal_id=<uuid> company_id=<uuid>
  activity-create '{"activity":{"type":"note","body":"..."},"links":[...]}' | activity-update id=<uuid> type=note body=... occurred_at=... | activity-delete id=<uuid> | notes | note-update id=<uuid> body=... occurred_at=... | note-delete id=<uuid>
  timeline entity_type=person entity_id=<uuid> | search q=ada
  tags | tag-create name=Important color=red | tag-attach tag_id=<uuid> entity_type=person entity_id=<uuid>
  workspaces | workspace-create name=... description=... | workspace-entities id=<uuid> [entity_type=person|company|deal|task]
  workspace-link workspace_id=<uuid> entity_type=person|company|deal|task entity_id=<uuid>
  tasks | task-create workspace_id=<uuid> entity_type=person entity_id=<uuid> title="Follow up" due=end-of-may | task-update id=<uuid> due=tomorrow | task-complete id=<uuid> | task-delete id=<uuid>
  dashboard
  email-accounts | email-account-create name=Work email=me@example.com imap_host=... smtp_host=... secret=... | email-account-test ... | email-account-update id=<uuid> ... | email-account-delete id=<uuid>
  email-sync [limit=...]
  assistant-conversations | audit-logs [limit=... offset=...]
  suggestions [status=open] | suggestion-create kind=follow_up entity_type=person entity_id=<uuid> context="..."
  suggestion-accept id=<uuid> | suggestion-link-person id=<uuid> person_id=<uuid> | suggestion-link-company id=<uuid> company_id=<uuid>
  suggestion-dismiss id=<uuid> | suggestion-suppress id=<uuid>`)
}

func runAuth(args []string, base string) {
	usage := "usage: crmctl auth set [--api <url>] <api-token> | auth show | auth clear"
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, usage)
		os.Exit(2)
	}
	switch args[0] {
	case "set":
		token, api := "", base
		for i := 1; i < len(args); i++ {
			if args[i] == "--api" && i+1 < len(args) {
				api = args[i+1]
				i++
				continue
			}
			if strings.HasPrefix(args[i], "--api=") {
				api = strings.TrimPrefix(args[i], "--api=")
				continue
			}
			if strings.HasPrefix(args[i], "token=") {
				token = strings.TrimPrefix(args[i], "token=")
				continue
			}
			if token == "" {
				token = args[i]
			}
		}
		if token == "" {
			fatal(fmt.Errorf("token is required"))
		}
		api = strings.TrimRight(api, "/")
		if err := storeDefaultAPI(api); err != nil {
			fatal(err)
		}
		if err := storeAPIToken(api, token); err != nil {
			fatal(err)
		}
		fmt.Printf("Token saved for %s.\n", api)
	case "show":
		token, source := apiToken(base)
		fmt.Printf("Server address: %s\n", base)
		if token == "" {
			fmt.Println("Token: not configured")
			return
		}
		fmt.Printf("Token: %s (%s)\n", maskToken(token), source)
	case "clear":
		if err := clearAPIToken(base); err != nil {
			fatal(err)
		}
		if err := clearDefaultAPI(); err != nil {
			fatal(err)
		}
		fmt.Println("Token cleared.")
	default:
		fmt.Fprintln(os.Stderr, usage)
		os.Exit(2)
	}
}

func apiBase() string {
	if base := os.Getenv("CRME_API"); base != "" {
		return strings.TrimRight(base, "/")
	}
	if base, err := os.ReadFile(defaultAPIFile()); err == nil && strings.TrimSpace(string(base)) != "" {
		return strings.TrimRight(strings.TrimSpace(string(base)), "/")
	}
	return "http://localhost:8080"
}

func setAuthHeaders(req *http.Request, base string) {
	if token, _ := apiToken(base); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
		return
	}
	if session := os.Getenv("CRME_SESSION"); session != "" {
		req.Header.Set("X-CRM-Session", session)
	}
}

func apiToken(base string) (string, string) {
	if token := os.Getenv("CRME_TOKEN"); token != "" {
		return token, "CRME_TOKEN"
	}
	if token, err := keychainToken(base); err == nil && token != "" {
		return token, "keychain"
	}
	if token, err := os.ReadFile(tokenFile(base)); err == nil {
		return strings.TrimSpace(string(token)), tokenFile(base)
	}
	return "", ""
}

func storeAPIToken(base, token string) error {
	if runtime.GOOS == "darwin" {
		if err := exec.Command("security", "add-generic-password", "-a", keychainAccount(), "-s", keychainService(base), "-w", token, "-U").Run(); err == nil {
			_ = os.Remove(tokenFile(base))
			return nil
		}
	}
	path := tokenFile(base)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(token+"\n"), 0o600)
}

func clearAPIToken(base string) error {
	if runtime.GOOS == "darwin" {
		_ = exec.Command("security", "delete-generic-password", "-a", keychainAccount(), "-s", keychainService(base)).Run()
	}
	if err := os.Remove(tokenFile(base)); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func keychainToken(base string) (string, error) {
	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("keychain unavailable")
	}
	out, err := exec.Command("security", "find-generic-password", "-a", keychainAccount(), "-s", keychainService(base), "-w").Output()
	return strings.TrimSpace(string(out)), err
}

func keychainAccount() string {
	if user := os.Getenv("USER"); user != "" {
		return user
	}
	return "default"
}

func keychainService(base string) string {
	return "crme:" + strings.TrimRight(base, "/")
}

func storeDefaultAPI(base string) error {
	path := defaultAPIFile()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(strings.TrimRight(base, "/")+"\n"), 0o600)
}

func clearDefaultAPI() error {
	if err := os.Remove(defaultAPIFile()); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func configDir() string {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		return "."
	}
	return filepath.Join(dir, "crme")
}

func defaultAPIFile() string {
	return filepath.Join(configDir(), "api")
}

func tokenFile(base string) string {
	return filepath.Join(configDir(), url.QueryEscape(strings.TrimRight(base, "/")), "token")
}

func maskToken(token string) string {
	if len(token) <= 14 {
		return "••••"
	}
	return token[:9] + "…" + token[len(token)-4:]
}

var chatInput *bufio.Reader

type chatCompletion struct {
	Text           string           `json:"text"`
	PendingAction  *domain.AIAction `json:"pending_action"`
	ConversationID domain.ID        `json:"conversation_id"`
}

func runChat(base string, client *http.Client) {
	chatInput = bufio.NewReader(os.Stdin)
	history := []domain.AIMessage{}
	var conversationID domain.ID
	fmt.Println("crme chat. Type exit to quit.")
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
		for {
			completion, err := chatTurn(base, client, conversationID, history)
			if err != nil {
				fmt.Fprintln(os.Stderr, err)
				break
			}
			conversationID = completion.ConversationID
			history = append(history, domain.AIMessage{Role: "assistant", Content: completion.Text})
			if strings.TrimSpace(completion.Text) != "" {
				fmt.Println(completion.Text)
			}
			if completion.PendingAction == nil {
				break
			}
			action := *completion.PendingAction
			if !confirmCommand(action.Command, action.Args) {
				history = append(history, domain.AIMessage{Role: "user", Content: "Action cancelled by user."})
				break
			}
			out, err := executeAssistantAction(base, client, action)
			if err != nil {
				out = []byte("ERROR: " + err.Error() + "\n" + string(out))
			}
			history = append(history, domain.AIMessage{Role: "user", Content: "Action result:\n" + truncate(string(out), 6000)})
		}
	}
}

func chatTurn(base string, client *http.Client, conversationID domain.ID, history []domain.AIMessage) (chatCompletion, error) {
	body, _ := json.Marshal(map[string]any{"conversation_id": conversationID, "messages": history})
	out, err := apiRequest(base, client, http.MethodPost, "/ai/chat", body)
	if err != nil {
		return chatCompletion{}, err
	}
	var completion chatCompletion
	if err := json.Unmarshal(out, &completion); err != nil {
		return chatCompletion{}, err
	}
	return completion, nil
}

func executeAssistantAction(base string, client *http.Client, action domain.AIAction) ([]byte, error) {
	body, _ := json.Marshal(action)
	return apiRequest(base, client, http.MethodPost, "/ai/actions/execute", body)
}

func apiRequest(base string, client *http.Client, method, path string, body []byte) ([]byte, error) {
	req, err := http.NewRequest(method, strings.TrimRight(base, "/")+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	if len(body) > 0 {
		req.Header.Set("Content-Type", "application/json")
	}
	setAuthHeaders(req, base)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	out, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return out, fmt.Errorf("%s", strings.TrimSpace(string(out)))
	}
	return out, nil
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
	case "organizations":
		return []string{"id", "name", "role", "created_at"}
	case "organization-members":
		return []string{"user_id", "email", "role", "joined_at"}
	case "organization-invitations":
		return []string{"id", "email", "role", "status", "expires_at"}
	case "people", "company-people", "deal-people":
		return []string{"id", "name", "email", "linkedin_url", "city", "status", "source", "last_touch_at"}
	case "companies", "person-companies", "deal-companies":
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
	case "assistant-conversations":
		return []string{"id", "title", "created_at", "updated_at"}
	case "audit-logs":
		return []string{"id", "actor_user_id", "action", "entity_type", "entity_id", "created_at"}
	case "notes":
		return []string{"id", "body", "occurred_at", "created_at"}
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
	return queryExcept(args)
}

func queryExcept(args []string, exclude ...string) string {
	if len(args) == 0 {
		return ""
	}
	excluded := map[string]bool{}
	for _, key := range exclude {
		excluded[key] = true
	}
	values := url.Values{}
	for _, a := range args {
		k, v, ok := strings.Cut(a, "=")
		if ok && !excluded[k] {
			values.Add(k, v)
		}
	}
	encoded := values.Encode()
	if encoded == "" {
		return ""
	}
	return "?" + encoded
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

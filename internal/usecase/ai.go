package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"crme/internal/domain"
	"crme/internal/ports"
)

type AIService struct {
	UOW           ports.UnitOfWork
	Prompts       ports.AIPromptStore
	Conversations ports.AssistantConversationStore
	People        ports.PersonStore
	Companies     ports.CompanyStore
	Deals         ports.DealStore
	Relationships ports.RelationshipStore
	Activities    ports.ActivityStore
	Tags          ports.TagStore
	Workspaces    ports.WorkspaceStore
	Search        ports.SearchStore
	Todos         ports.TodoStore
	Emails        ports.EmailMessageStore
	AI            ports.AICompleter
}

func (s AIService) DraftPrompt(ctx context.Context, kind domain.AIPromptKind, entityType domain.EntityType, entityID domain.ID, contextText string) (domain.AIPrompt, error) {
	if s.AI == nil {
		return s.Prompts.CreateAIPrompt(ctx, domain.AIPrompt{Kind: kind, EntityType: entityType, EntityID: entityID, Title: string(kind), Body: contextText, Status: "open"})
	}
	completion, err := s.AI.Complete(ctx, domain.AICompletionRequest{
		System:   "You are the native CRM assistant. Produce a concise action prompt for the user. Include why it matters and a suggested next action.",
		Messages: []domain.AIMessage{{Role: "user", Content: fmt.Sprintf("kind=%s entity=%s/%s context=%s", kind, entityType, entityID, contextText)}},
	})
	if err != nil {
		return domain.AIPrompt{}, err
	}
	return s.Prompts.CreateAIPrompt(ctx, domain.AIPrompt{Kind: kind, EntityType: entityType, EntityID: entityID, Title: string(kind), Body: completion.Text, Status: "open"})
}

func (s AIService) withStores(stores ports.Stores) AIService {
	if stores.Prompts != nil {
		s.Prompts = stores.Prompts
	}
	if stores.AssistantConversations != nil {
		s.Conversations = stores.AssistantConversations
	}
	if stores.People != nil {
		s.People = stores.People
	}
	if stores.Companies != nil {
		s.Companies = stores.Companies
	}
	if stores.Deals != nil {
		s.Deals = stores.Deals
	}
	if stores.Relationships != nil {
		s.Relationships = stores.Relationships
	}
	if stores.Activities != nil {
		s.Activities = stores.Activities
	}
	if stores.Tags != nil {
		s.Tags = stores.Tags
	}
	if stores.Workspaces != nil {
		s.Workspaces = stores.Workspaces
	}
	if stores.Search != nil {
		s.Search = stores.Search
	}
	if stores.Todos != nil {
		s.Todos = stores.Todos
	}
	if stores.EmailMessages != nil {
		s.Emails = stores.EmailMessages
	}
	return s
}

func (s AIService) ListConversations(ctx context.Context, sessionID domain.ID, limit int) ([]domain.AssistantConversation, error) {
	if s.Conversations == nil {
		return nil, nil
	}
	return s.Conversations.ListAssistantConversations(ctx, sessionID, saneLimit(limit))
}

func (s AIService) SaveConversation(ctx context.Context, conversation domain.AssistantConversation) (domain.AssistantConversation, error) {
	if s.Conversations == nil {
		return conversation, nil
	}
	conversation.Messages = trimAIMessages(conversation.Messages, 40)
	conversation.Title = strings.TrimSpace(conversation.Title)
	if conversation.Title == "" {
		conversation.Title = conversationTitle(conversation.Messages)
	}
	return s.Conversations.UpsertAssistantConversation(ctx, conversation)
}

func trimAIMessages(messages []domain.AIMessage, limit int) []domain.AIMessage {
	if limit <= 0 || len(messages) <= limit {
		return messages
	}
	return messages[len(messages)-limit:]
}

func conversationTitle(messages []domain.AIMessage) string {
	for _, message := range messages {
		if message.Role != "user" {
			continue
		}
		text := strings.TrimSpace(message.Content)
		if isAssistantSyntheticUserMessage(text) {
			continue
		}
		return truncatePromptText(strings.ReplaceAll(text, "\n", " "), 80)
	}
	return "Assistant conversation"
}

func (s AIService) Chat(ctx context.Context, messages []domain.AIMessage) (domain.AICompletion, error) {
	if len(messages) == 0 {
		return domain.AICompletion{}, fmt.Errorf("at least one message is required")
	}
	if s.AI == nil {
		last := strings.TrimSpace(messages[len(messages)-1].Content)
		return domain.AICompletion{Text: "AI is not configured. I can still help you triage CRM suggestions once OPENROUTER_API_KEY is set. Last message: " + last}, nil
	}

	if out, ok := s.answerEntityRetrievalIntent(ctx, messages); ok {
		return out, nil
	}

	agentMessages := append([]domain.AIMessage(nil), messages...)
	for i := 0; i < 6; i++ {
		completion, err := s.AI.Complete(ctx, domain.AICompletionRequest{System: assistantSystemPrompt(time.Now()), Messages: agentMessages})
		if err != nil {
			return domain.AICompletion{}, err
		}
		resp, err := parseAssistantAgentResponse(completion.Text)
		if err != nil {
			return parseStructuredChatCompletion(completion.Text), nil
		}
		resp = normalizeAssistantAgentResponse(resp)
		if resp.Type == "tool_call" {
			result, err := s.runAssistantReadTool(ctx, resp.Tool, resp.Args)
			if err != nil {
				result = map[string]any{"error": err.Error()}
			}
			requestJSON, _ := json.Marshal(resp)
			resultJSON, _ := json.Marshal(result)
			agentMessages = append(agentMessages,
				domain.AIMessage{Role: "assistant", Content: string(requestJSON)},
				domain.AIMessage{Role: "user", Content: "TOOL_RESULT " + resp.Tool + ":\n" + truncatePromptText(string(resultJSON), 12000)},
			)
			continue
		}
		if resp.Type != "final" {
			fallback := parseStructuredChatCompletion(completion.Text)
			if strings.TrimSpace(fallback.Text) != "" && fallback.Text != completion.Text {
				return fallback, nil
			}
			return domain.AICompletion{Text: "I could not use the assistant response. Raw response: " + truncatePromptText(completion.Text, 500)}, nil
		}
		entityRefs := resp.entityRefs()
		out := domain.AICompletion{Text: resp.Text, PendingAction: resp.PendingAction, Entities: s.expandAssistantEntityRefs(ctx, dedupeEntityRefs(entityRefs))}
		if strings.TrimSpace(out.Text) == "" {
			out.Text = "Done."
		}
		if out.PendingAction != nil && !allowedAssistantAction(out.PendingAction.Command) {
			return domain.AICompletion{Text: fmt.Sprintf("Unsupported assistant action %q.", out.PendingAction.Command)}, nil
		}
		return out, nil
	}
	return domain.AICompletion{Text: "I looked through the CRM but need a more specific request to continue."}, nil
}

type assistantAgentResponse struct {
	Type          string               `json:"type"`
	Text          string               `json:"text"`
	Message       string               `json:"message"`
	Tool          string               `json:"tool"`
	Name          string               `json:"name"`
	Command       string               `json:"command"`
	Args          map[string]any       `json:"args"`
	Arguments     map[string]any       `json:"arguments"`
	PendingAction *domain.AIAction     `json:"pending_action,omitempty"`
	Entities      []assistantEntityRef `json:"entities,omitempty"`
}

type assistantEntityRef struct {
	EntityType domain.EntityType `json:"entity_type"`
	EntityID   domain.ID         `json:"entity_id"`
	Title      string            `json:"title"`
	Subtitle   string            `json:"subtitle"`
	Type       string            `json:"type"`
	ID         domain.ID         `json:"id"`
	Name       string            `json:"name"`
	Email      string            `json:"email"`
	Company    string            `json:"company"`
}

func looksLikeUUID(id domain.ID) bool {
	value := string(id)
	return len(value) == 36 && value[8] == '-' && value[13] == '-' && value[18] == '-' && value[23] == '-'
}

func (r assistantAgentResponse) entityRefs() []domain.SearchResult {
	out := make([]domain.SearchResult, 0, len(r.Entities))
	for _, entity := range r.Entities {
		entityType := entity.EntityType
		if entityType == "" {
			entityType = domain.EntityType(entity.Type)
		}
		id := entity.EntityID
		if id == "" {
			id = entity.ID
		}
		title := firstNonEmpty(entity.Title, entity.Name)
		subtitle := firstNonEmpty(entity.Subtitle, entity.Email, entity.Company)
		if !validEntityType(entityType) || id == "" || title == "" || !looksLikeUUID(id) {
			continue
		}
		out = append(out, domain.SearchResult{EntityType: entityType, EntityID: id, Title: title, Subtitle: subtitle})
	}
	return out
}

func assistantSystemPrompt(now time.Time) string {
	return fmt.Sprintf(`You are CRME's embedded CRM assistant. You are already inside the user's CRM. Today's date is %s.

Respond with exactly one JSON object and no prose. Never emit XML, HTML, <function_calls>, <invoke>, <parameter>, markdown code fences, or fake tool transcripts.
For a final answer: {"type":"final","text":"short message","pending_action":{"command":"crm mutation command","args":["key=value"]}}
To inspect CRM data: {"type":"tool_call","tool":"crm.search","args":{"q":"medsolve","limit":10}}

Use read-only tools whenever a person, company, deal, task, note, workspace, tag, suggestion, or email thread needs to be resolved or inspected. Do not claim a record is missing until you searched for it. Prefer crm.search first for broad names, then specific tools when needed.

Read-only tools you may call automatically:
crm.search q limit
crm.people q workspace_id limit offset; crm.person_get id; crm.person_companies person_id limit
crm.companies q workspace_id limit offset; crm.company_get id; crm.company_people company_id limit
crm.deals q workspace_id limit offset; crm.deal_get id; crm.deal_people deal_id limit; crm.deal_companies deal_id limit
crm.workspaces limit; crm.workspace_entities workspace_id entity_type limit
crm.tasks q status entity_type entity_id workspace_id limit offset
crm.timeline entity_type entity_id limit; crm.notes limit
crm.tags limit; crm.suggestions status limit
crm.email_messages address domain limit
crm.resolve_entities mentions (array of names/domains/titles you plan to mention in the final answer)

Never call tools to mutate CRM data. Mutations require user confirmation in the app. To propose a mutation, return final with pending_action. Never say a CRM mutation already happened.

If your final answer presents or names CRM records, resolve them first with crm.search, specific read tools, or crm.resolve_entities. Then include only the records you intentionally present in final.entities. Do not include incidental search results. Do not present CRM records as plain text only. final.entities must use real IDs from tool results and this exact shape: {"entity_type":"person|company|deal|task","entity_id":"real uuid from tool result","title":"display name","subtitle":"short context"}. Never invent IDs like p_01, c_01, ws_01.

If you propose a mutation, return pending_action. Do not write "Confirm this action?" yourself; the app renders confirmation buttons from pending_action.

When you receive ACTION_RESULT, use the returned JSON IDs to continue the user's original workflow. Propose at most one next pending_action. If no more steps are needed, return a final answer without pending_action.

Mutating commands you may propose:
person-create, person-update, company-create, company-update, deal-create, deal-update, link-person-company, unlink-person-company, link-deal-person, unlink-deal-person, link-deal-company, unlink-deal-company, activity-create, activity-update, note-update, tag-create, tag-attach, workspace-create, workspace-link, task-create, task-update, task-complete, email-sync, suggestion-create, suggestion-accept, suggestion-link-person, suggestion-link-company, suggestion-dismiss, suggestion-suppress.

Use backend field names exactly. Important deal-create fields are name, stage, value_cents, currency, workspace_id. You may include person_id and company_id with deal-create to link them after creation. Values are in cents, so 5k EUR is value_cents=500000 currency=EUR.

Never ask the user for internal IDs, and never include internal IDs in user-facing text. Use IDs only inside tool args and pending_action args. If a safe match exists in tool results, use it. If no safe match exists, ask one concise disambiguation question by name/email/title/domain. Do not re-ask questions already answered in the conversation.`, now.Format("2006-01-02"))
}

func parseAssistantAgentResponse(text string) (assistantAgentResponse, error) {
	for _, raw := range jsonObjectsInText(text) {
		var resp assistantAgentResponse
		if err := json.Unmarshal([]byte(raw), &resp); err != nil {
			continue
		}
		resp = normalizeAssistantAgentResponse(resp)
		if resp.Type != "" {
			return resp, nil
		}
	}
	var resp assistantAgentResponse
	err := unmarshalJSONObject(text, &resp)
	return normalizeAssistantAgentResponse(resp), err
}

func normalizeAssistantAgentResponse(resp assistantAgentResponse) assistantAgentResponse {
	resp.Type = strings.TrimSpace(strings.ToLower(resp.Type))
	if resp.Text == "" {
		resp.Text = resp.Message
	}
	if resp.Tool == "" {
		resp.Tool = firstNonEmpty(resp.Name, resp.Command)
	}
	if resp.Args == nil {
		resp.Args = resp.Arguments
	}
	if resp.Type == "" {
		if resp.Tool != "" {
			resp.Type = "tool_call"
		} else if strings.TrimSpace(resp.Text) != "" {
			resp.Type = "final"
		}
	}
	if resp.Type == "tool" || resp.Type == "command" || resp.Type == "function_call" {
		resp.Type = "tool_call"
	}
	return resp
}

func (s AIService) runAssistantReadTool(ctx context.Context, tool string, args map[string]any) (any, error) {
	q := argString(args, "q")
	limit := saneLimit(argInt(args, "limit", 10))
	offset := saneOffset(argInt(args, "offset", 0))
	workspaceID := domain.ID(argString(args, "workspace_id"))

	switch tool {
	case "crm.search":
		if s.Search == nil {
			return nil, fmt.Errorf("search is unavailable")
		}
		results, err := s.Search.Search(ctx, q, limit)
		if err != nil || len(results) > 0 {
			return results, err
		}
		return s.searchEntityTokens(ctx, q, limit), nil
	case "crm.people":
		if s.People == nil {
			return nil, fmt.Errorf("people search is unavailable")
		}
		return s.People.ListPeople(ctx, q, workspaceID, limit, offset)
	case "crm.person_get":
		if s.People == nil {
			return nil, fmt.Errorf("people are unavailable")
		}
		return s.People.GetPerson(ctx, domain.ID(argString(args, "id")))
	case "crm.person_companies":
		if s.Companies == nil {
			return nil, fmt.Errorf("companies are unavailable")
		}
		return s.Companies.ListCompaniesForPerson(ctx, domain.ID(argString(args, "person_id")), limit)
	case "crm.companies":
		if s.Companies == nil {
			return nil, fmt.Errorf("company search is unavailable")
		}
		return s.Companies.ListCompanies(ctx, q, workspaceID, limit, offset)
	case "crm.company_get":
		if s.Companies == nil {
			return nil, fmt.Errorf("companies are unavailable")
		}
		return s.Companies.GetCompany(ctx, domain.ID(argString(args, "id")))
	case "crm.company_people":
		if s.Companies == nil {
			return nil, fmt.Errorf("companies are unavailable")
		}
		return s.Companies.ListPeopleForCompany(ctx, domain.ID(argString(args, "company_id")), limit)
	case "crm.deals":
		if s.Deals == nil {
			return nil, fmt.Errorf("deals are unavailable")
		}
		return s.Deals.ListDeals(ctx, q, workspaceID, limit, offset)
	case "crm.deal_get":
		if s.Deals == nil {
			return nil, fmt.Errorf("deals are unavailable")
		}
		return s.Deals.GetDeal(ctx, domain.ID(argString(args, "id")))
	case "crm.deal_people":
		if s.Deals == nil {
			return nil, fmt.Errorf("deals are unavailable")
		}
		return s.Deals.ListPeopleForDeal(ctx, domain.ID(argString(args, "deal_id")), limit)
	case "crm.deal_companies":
		if s.Deals == nil {
			return nil, fmt.Errorf("deals are unavailable")
		}
		return s.Deals.ListCompaniesForDeal(ctx, domain.ID(argString(args, "deal_id")), limit)
	case "crm.workspaces":
		if s.Workspaces == nil {
			return nil, fmt.Errorf("workspaces are unavailable")
		}
		return s.Workspaces.ListWorkspaces(ctx, limit)
	case "crm.workspace_entities":
		if s.Workspaces == nil {
			return nil, fmt.Errorf("workspace entities are unavailable")
		}
		return s.Workspaces.ListWorkspaceEntities(ctx, domain.ID(argString(args, "workspace_id")), domain.EntityType(argString(args, "entity_type")), limit)
	case "crm.tasks":
		if s.Todos == nil {
			return nil, fmt.Errorf("tasks are unavailable")
		}
		return s.Todos.ListTodos(ctx, q, argString(args, "status"), argString(args, "due"), domain.EntityType(argString(args, "entity_type")), domain.ID(argString(args, "entity_id")), workspaceID, limit, offset)
	case "crm.timeline":
		if s.Activities == nil {
			return nil, fmt.Errorf("timeline is unavailable")
		}
		return s.Activities.ListTimeline(ctx, domain.EntityType(argString(args, "entity_type")), domain.ID(argString(args, "entity_id")), limit)
	case "crm.notes":
		if s.Activities == nil {
			return nil, fmt.Errorf("notes are unavailable")
		}
		return s.Activities.ListNotes(ctx, limit)
	case "crm.tags":
		if s.Tags == nil {
			return nil, fmt.Errorf("tags are unavailable")
		}
		return s.Tags.ListTags(ctx, limit)
	case "crm.suggestions":
		if s.Prompts == nil {
			return nil, fmt.Errorf("suggestions are unavailable")
		}
		return s.Prompts.ListAIPrompts(ctx, argString(args, "status"), limit, 0)
	case "crm.email_messages":
		if s.Emails == nil {
			return nil, fmt.Errorf("email messages are unavailable")
		}
		if address := argString(args, "address"); address != "" {
			return s.Emails.ListEmailMessagesForAddress(ctx, address, limit)
		}
		return s.Emails.ListEmailMessagesForDomain(ctx, argString(args, "domain"), limit)
	case "crm.resolve_entities":
		if s.Search == nil {
			return nil, fmt.Errorf("entity resolution is unavailable")
		}
		return s.resolveAssistantEntities(ctx, args, limit), nil
	default:
		return nil, fmt.Errorf("unknown read-only tool %q", tool)
	}
}

func argString(args map[string]any, key string) string {
	if args == nil {
		return ""
	}
	value, ok := args[key]
	if !ok || value == nil {
		return ""
	}
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case float64:
		return strings.TrimSpace(fmt.Sprintf("%.0f", v))
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func argInt(args map[string]any, key string, fallback int) int {
	if args == nil {
		return fallback
	}
	value, ok := args[key]
	if !ok || value == nil {
		return fallback
	}
	switch v := value.(type) {
	case float64:
		return int(v)
	case int:
		return v
	case string:
		var out int
		if _, err := fmt.Sscanf(v, "%d", &out); err == nil {
			return out
		}
	}
	return fallback
}

func (s AIService) answerEntityRetrievalIntent(ctx context.Context, messages []domain.AIMessage) (domain.AICompletion, bool) {
	if s.Search == nil || len(messages) == 0 {
		return domain.AICompletion{}, false
	}
	last := strings.TrimSpace(messages[len(messages)-1].Content)
	if messages[len(messages)-1].Role != "user" || isAssistantSyntheticUserMessage(last) || !looksLikeEntityRetrievalIntent(last) {
		return domain.AICompletion{}, false
	}
	refs := s.expandAssistantEntityRefs(ctx, dedupeEntityRefs(s.searchEntityTokens(ctx, last, 8)))
	if len(refs) == 0 {
		return domain.AICompletion{}, false
	}
	return domain.AICompletion{Text: entityRetrievalText(refs), Entities: refs}, true
}

func isAssistantSyntheticUserMessage(text string) bool {
	return strings.HasPrefix(text, "ACTION_RESULT:") || strings.EqualFold(text, "Confirm") || strings.EqualFold(text, "Cancel")
}

func looksLikeEntityRetrievalIntent(text string) bool {
	normalized := strings.ToLower(text)
	return strings.Contains(normalized, "zeig") || strings.Contains(normalized, "show") || strings.Contains(normalized, "open") || strings.Contains(normalized, "find") || strings.Contains(normalized, "such")
}

func entityRetrievalText(refs []domain.SearchResult) string {
	if len(refs) == 1 {
		return fmt.Sprintf("Hier ist %s:", refs[0].Title)
	}
	return "Ich habe diese passenden Einträge gefunden:"
}

func (s AIService) resolveAssistantEntities(ctx context.Context, args map[string]any, limit int) []domain.SearchResult {
	mentions := argStringSlice(args, "mentions")
	if len(mentions) == 0 {
		mentions = assistantSearchTokens(argString(args, "q"))
	}
	out := []domain.SearchResult{}
	for _, mention := range mentions {
		out = append(out, s.searchEntityTokens(ctx, mention, limit)...)
	}
	return dedupeEntityRefs(out)
}

func argStringSlice(args map[string]any, key string) []string {
	if args == nil {
		return nil
	}
	value, ok := args[key]
	if !ok || value == nil {
		return nil
	}
	switch v := value.(type) {
	case []any:
		out := make([]string, 0, len(v))
		for _, item := range v {
			if s := strings.TrimSpace(fmt.Sprint(item)); s != "" {
				out = append(out, s)
			}
		}
		return out
	case []string:
		return v
	case string:
		return []string{v}
	default:
		return nil
	}
}

func (s AIService) searchEntityTokens(ctx context.Context, query string, limit int) []domain.SearchResult {
	tokens := assistantSearchTokens(query)
	candidates := []domain.SearchResult{}
	for _, token := range tokens {
		results, err := s.Search.Search(ctx, token, limit)
		if err != nil {
			continue
		}
		candidates = append(candidates, results...)
	}
	return rankAssistantEntityMatches(tokens, candidates)
}

func rankAssistantEntityMatches(tokens []string, candidates []domain.SearchResult) []domain.SearchResult {
	if len(tokens) == 0 {
		return nil
	}
	type scored struct {
		ref   domain.SearchResult
		score int
	}
	seen := map[string]scored{}
	bestScore := 0
	for _, candidate := range candidates {
		key := string(candidate.EntityType) + ":" + string(candidate.EntityID)
		haystack := strings.ToLower(candidate.Title + " " + candidate.Subtitle)
		score := 0
		for _, token := range tokens {
			if strings.Contains(haystack, token) {
				score++
			}
		}
		if score == 0 {
			continue
		}
		if existing, ok := seen[key]; !ok || score > existing.score {
			seen[key] = scored{ref: candidate, score: score}
		}
		if score > bestScore {
			bestScore = score
		}
	}
	out := []domain.SearchResult{}
	for _, item := range seen {
		if len(tokens) > 1 && bestScore == len(tokens) && item.score < bestScore {
			continue
		}
		out = append(out, item.ref)
	}
	return dedupeEntityRefs(out)
}

func assistantSearchTokens(query string) []string {
	stop := map[string]bool{"show": true, "me": true, "mir": true, "zeig": true, "zeige": true, "bitte": true, "den": true, "die": true, "das": true, "der": true, "dem": true, "deal": true, "person": true, "company": true, "firma": true, "kontakt": true}
	parts := strings.FieldsFunc(strings.ToLower(query), func(r rune) bool {
		return (r < 'a' || r > 'z') && (r < '0' || r > '9')
	})
	out := []string{}
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if len(part) < 3 || stop[part] {
			continue
		}
		out = append(out, part)
		if len(out) >= 5 {
			break
		}
	}
	return out
}

func assistantEntityRefs(tool string, result any) []domain.SearchResult {
	switch value := result.(type) {
	case []domain.SearchResult:
		return value
	case []domain.Person:
		out := make([]domain.SearchResult, 0, len(value))
		for _, person := range value {
			out = append(out, domain.SearchResult{EntityType: domain.EntityPerson, EntityID: person.ID, Title: strings.TrimSpace(person.FirstName + " " + person.LastName), Subtitle: person.Email})
		}
		return out
	case []domain.Company:
		out := make([]domain.SearchResult, 0, len(value))
		for _, company := range value {
			out = append(out, domain.SearchResult{EntityType: domain.EntityCompany, EntityID: company.ID, Title: company.Name, Subtitle: company.Domain})
		}
		return out
	case []domain.Deal:
		out := make([]domain.SearchResult, 0, len(value))
		for _, deal := range value {
			out = append(out, domain.SearchResult{EntityType: domain.EntityDeal, EntityID: deal.ID, Title: deal.Name, Subtitle: deal.Stage})
		}
		return out
	case []domain.Todo:
		out := make([]domain.SearchResult, 0, len(value))
		for _, task := range value {
			out = append(out, domain.SearchResult{EntityType: domain.EntityTodo, EntityID: task.ID, Title: task.Title, Subtitle: string(task.Status)})
		}
		return out
	case domain.Person:
		return []domain.SearchResult{{EntityType: domain.EntityPerson, EntityID: value.ID, Title: strings.TrimSpace(value.FirstName + " " + value.LastName), Subtitle: value.Email}}
	case domain.Company:
		return []domain.SearchResult{{EntityType: domain.EntityCompany, EntityID: value.ID, Title: value.Name, Subtitle: value.Domain}}
	case domain.Deal:
		return []domain.SearchResult{{EntityType: domain.EntityDeal, EntityID: value.ID, Title: value.Name, Subtitle: value.Stage}}
	case domain.Todo:
		return []domain.SearchResult{{EntityType: domain.EntityTodo, EntityID: value.ID, Title: value.Title, Subtitle: string(value.Status)}}
	default:
		_ = tool
		return nil
	}
}

func (s AIService) expandAssistantEntityRefs(ctx context.Context, refs []domain.SearchResult) []domain.SearchResult {
	out := append([]domain.SearchResult(nil), refs...)
	for _, ref := range refs {
		if ref.EntityType != domain.EntityDeal || s.Deals == nil {
			continue
		}
		people, err := s.Deals.ListPeopleForDeal(ctx, ref.EntityID, 5)
		if err == nil {
			out = append(out, assistantEntityRefs("crm.deal_people", people)...)
		}
		companies, err := s.Deals.ListCompaniesForDeal(ctx, ref.EntityID, 5)
		if err == nil {
			out = append(out, assistantEntityRefs("crm.deal_companies", companies)...)
		}
	}
	return dedupeEntityRefs(out)
}

func dedupeEntityRefs(refs []domain.SearchResult) []domain.SearchResult {
	seen := map[string]bool{}
	out := []domain.SearchResult{}
	for _, ref := range refs {
		if ref.EntityID == "" || ref.Title == "" {
			continue
		}
		key := string(ref.EntityType) + ":" + string(ref.EntityID)
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, ref)
		if len(out) >= 8 {
			break
		}
	}
	return out
}

func parseStructuredChatCompletion(text string) domain.AICompletion {
	var out domain.AICompletion
	if err := unmarshalJSONObject(text, &out); err == nil && strings.TrimSpace(out.Text) != "" {
		return out
	}
	var agentOut assistantAgentResponse
	if err := unmarshalJSONObject(text, &agentOut); err == nil && strings.TrimSpace(agentOut.Text) != "" {
		return domain.AICompletion{Text: agentOut.Text, PendingAction: agentOut.PendingAction}
	}
	if extracted, ok := extractMalformedFinalText(text); ok {
		return domain.AICompletion{Text: extracted}
	}
	if action, ok := extractPendingAction(text); ok {
		return domain.AICompletion{Text: cleanAssistantText(text), PendingAction: &action}
	}
	return domain.AICompletion{Text: text}
}

func extractMalformedFinalText(text string) (string, bool) {
	start := strings.Index(text, `"text":"`)
	if start < 0 || !strings.Contains(text, `"type":"final"`) {
		return "", false
	}
	from := start + len(`"text":"`)
	end := strings.Index(text[from:], `","pending_action"`)
	if end < 0 {
		return "", false
	}
	out := text[from : from+end]
	out = strings.ReplaceAll(out, `\n`, "\n")
	out = strings.ReplaceAll(out, `\"`, `"`)
	out = strings.TrimSpace(out)
	return out, out != ""
}

func extractPendingAction(text string) (domain.AIAction, bool) {
	start := strings.Index(text, `"pending_action"`)
	if start < 0 {
		return domain.AIAction{}, false
	}
	colon := strings.Index(text[start:], ":")
	if colon < 0 {
		return domain.AIAction{}, false
	}
	objectStart := strings.Index(text[start+colon:], "{")
	if objectStart < 0 {
		return domain.AIAction{}, false
	}
	from := start + colon + objectStart
	depth := 0
	inString := false
	escaped := false
	for i := from; i < len(text); i++ {
		ch := text[i]
		if inString {
			if escaped {
				escaped = false
				continue
			}
			if ch == '\\' {
				escaped = true
				continue
			}
			if ch == '"' {
				inString = false
			}
			continue
		}
		switch ch {
		case '"':
			inString = true
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				var action domain.AIAction
				if err := json.Unmarshal([]byte(text[from:i+1]), &action); err == nil && action.Command != "" {
					return action, true
				}
				return domain.AIAction{}, false
			}
		}
	}
	return domain.AIAction{}, false
}

func cleanAssistantText(text string) string {
	trimmed := strings.TrimSpace(text)
	if idx := strings.Index(trimmed, "{"); idx > 0 {
		trimmed = strings.TrimSpace(trimmed[:idx])
	}
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	trimmed = strings.TrimSpace(trimmed)
	if trimmed == "" {
		return "Please confirm this action."
	}
	return trimmed
}

func unmarshalJSONObject(text string, out any) error {
	trimmed := strings.TrimSpace(text)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	trimmed = strings.TrimSpace(trimmed)
	if err := json.Unmarshal([]byte(trimmed), out); err == nil {
		return nil
	}
	for _, raw := range jsonObjectsInText(trimmed) {
		if err := json.Unmarshal([]byte(raw), out); err == nil {
			return nil
		}
	}
	return fmt.Errorf("response did not contain a JSON object")
}

func jsonObjectsInText(text string) []string {
	objects := []string{}
	depth := 0
	start := -1
	inString := false
	escaped := false
	for i := 0; i < len(text); i++ {
		ch := text[i]
		if inString {
			if escaped {
				escaped = false
				continue
			}
			if ch == '\\' {
				escaped = true
				continue
			}
			if ch == '"' {
				inString = false
			}
			continue
		}
		switch ch {
		case '"':
			inString = true
		case '{':
			if depth == 0 {
				start = i
			}
			depth++
		case '}':
			if depth == 0 {
				continue
			}
			depth--
			if depth == 0 && start >= 0 {
				objects = append(objects, text[start:i+1])
				start = -1
			}
		}
	}
	return objects
}

func (s AIService) ExecuteAction(ctx context.Context, action domain.AIAction) (out any, err error) {
	if !allowedAssistantAction(action.Command) {
		return nil, fmt.Errorf("unsupported assistant action %q", action.Command)
	}
	args := assistantActionArgs(action.Args)
	if err := validateAssistantActionArgs(action.Command, args); err != nil {
		return nil, err
	}
	stores := ports.Stores{People: s.People, Companies: s.Companies, Deals: s.Deals, Relationships: s.Relationships, Activities: s.Activities, Tags: s.Tags, Workspaces: s.Workspaces, Todos: s.Todos, Prompts: s.Prompts, EmailMessages: s.Emails}

	run := func(stores ports.Stores) (any, error) {
		svc := CRMService{People: stores.People, Companies: stores.Companies, Deals: stores.Deals, Relationships: stores.Relationships, Activities: stores.Activities, Tags: stores.Tags, Workspaces: stores.Workspaces, Todos: stores.Todos}
		suggestionSvc := SuggestionService{Prompts: stores.Prompts, People: stores.People, Companies: stores.Companies, Relationships: stores.Relationships, Activities: stores.Activities, Emails: stores.EmailMessages}
		success := map[string]string{"status": "ok"}
		switch action.Command {
		case "person-create":
			return svc.CreatePersonInWorkspace(ctx, personFromArgs(args, domain.Person{}), domain.ID(args["workspace_id"]))
		case "person-update":
			p, err := svc.GetPerson(ctx, domain.ID(requiredActionArg(args, "id")))
			if err != nil {
				return nil, err
			}
			return svc.UpdatePerson(ctx, personFromArgs(args, p))
		case "company-create":
			return svc.CreateCompanyInWorkspace(ctx, companyFromArgs(args, domain.Company{}), domain.ID(args["workspace_id"]))
		case "company-update":
			c, err := svc.GetCompany(ctx, domain.ID(requiredActionArg(args, "id")))
			if err != nil {
				return nil, err
			}
			return svc.UpdateCompany(ctx, companyFromArgs(args, c))
		case "deal-create":
			deal, err := svc.CreateDeal(ctx, dealFromArgs(args, domain.Deal{}))
			if err != nil {
				return nil, err
			}
			if personID := domain.ID(args["person_id"]); personID != "" {
				if err := svc.LinkDealPerson(ctx, deal.ID, personID); err != nil {
					return nil, err
				}
			}
			if companyID := domain.ID(args["company_id"]); companyID != "" {
				if err := svc.LinkDealCompany(ctx, deal.ID, companyID); err != nil {
					return nil, err
				}
			}
			return deal, nil
		case "deal-update":
			d, err := svc.GetDeal(ctx, domain.ID(requiredActionArg(args, "id")))
			if err != nil {
				return nil, err
			}
			return svc.UpdateDeal(ctx, dealFromArgs(args, d))
		case "link-person-company":
			return success, svc.LinkPersonCompany(ctx, domain.ID(requiredActionArg(args, "person_id")), domain.ID(requiredActionArg(args, "company_id")), args["role"])
		case "unlink-person-company":
			return success, svc.UnlinkPersonCompany(ctx, domain.ID(requiredActionArg(args, "person_id")), domain.ID(requiredActionArg(args, "company_id")))
		case "link-deal-person":
			return success, svc.LinkDealPerson(ctx, domain.ID(requiredActionArg(args, "deal_id")), domain.ID(requiredActionArg(args, "person_id")))
		case "unlink-deal-person":
			return success, svc.UnlinkDealPerson(ctx, domain.ID(requiredActionArg(args, "deal_id")), domain.ID(requiredActionArg(args, "person_id")))
		case "link-deal-company":
			return success, svc.LinkDealCompany(ctx, domain.ID(requiredActionArg(args, "deal_id")), domain.ID(requiredActionArg(args, "company_id")))
		case "unlink-deal-company":
			return success, svc.UnlinkDealCompany(ctx, domain.ID(requiredActionArg(args, "deal_id")), domain.ID(requiredActionArg(args, "company_id")))
		case "activity-create":
			activity := activityFromArgs(args, domain.Activity{Type: domain.ActivityNote, Body: args["body"], OccurredAt: time.Now().UTC()})
			links := []domain.ActivityLink{}
			if args["entity_type"] != "" && args["entity_id"] != "" {
				links = append(links, domain.ActivityLink{EntityType: domain.EntityType(args["entity_type"]), EntityID: domain.ID(args["entity_id"])})
			}
			return svc.CreateActivity(ctx, activity, links)
		case "activity-update":
			a, err := svc.GetActivity(ctx, domain.ID(requiredActionArg(args, "id")))
			if err != nil {
				return nil, err
			}
			return svc.UpdateActivity(ctx, activityFromArgs(args, a))
		case "note-update":
			a, err := svc.GetActivity(ctx, domain.ID(requiredActionArg(args, "id")))
			if err != nil {
				return nil, err
			}
			args["type"] = string(domain.ActivityNote)
			return svc.UpdateNote(ctx, activityFromArgs(args, a))
		case "tag-create":
			return svc.CreateTag(ctx, domain.Tag{Name: requiredActionArg(args, "name"), Color: args["color"]})
		case "tag-attach":
			return success, svc.TagEntity(ctx, domain.ID(requiredActionArg(args, "tag_id")), domain.EntityType(requiredActionArg(args, "entity_type")), domain.ID(requiredActionArg(args, "entity_id")))
		case "workspace-create":
			return svc.CreateWorkspace(ctx, domain.Workspace{Name: requiredActionArg(args, "name"), Description: args["description"]})
		case "workspace-link":
			return success, svc.LinkWorkspaceEntity(ctx, domain.ID(requiredActionArg(args, "workspace_id")), domain.EntityType(requiredActionArg(args, "entity_type")), domain.ID(requiredActionArg(args, "entity_id")))
		case "task-create":
			return svc.CreateTodo(ctx, todoFromArgs(args, domain.Todo{}))
		case "task-update":
			t, err := svc.GetTodo(ctx, domain.ID(requiredActionArg(args, "id")))
			if err != nil {
				return nil, err
			}
			return svc.UpdateTodo(ctx, todoFromArgs(args, t))
		case "task-complete":
			return svc.CompleteTodo(ctx, domain.ID(requiredActionArg(args, "id")))
		case "suggestion-create":
			return suggestionSvc.CreatePrompt(ctx, domain.AIPrompt{Kind: domain.AIPromptKind(args["kind"]), EntityType: domain.EntityType(args["entity_type"]), EntityID: domain.ID(args["entity_id"]), Title: requiredActionArg(args, "title"), Body: args["body"], Status: firstNonEmpty(args["status"], "open")})
		case "suggestion-accept":
			return suggestionSvc.AcceptPrompt(ctx, domain.ID(requiredActionArg(args, "id")))
		case "suggestion-link-person":
			return suggestionSvc.LinkSuggestionToPerson(ctx, domain.ID(requiredActionArg(args, "id")), domain.ID(requiredActionArg(args, "person_id")))
		case "suggestion-link-company":
			return suggestionSvc.LinkSuggestionToCompany(ctx, domain.ID(requiredActionArg(args, "id")), domain.ID(requiredActionArg(args, "company_id")))
		case "suggestion-dismiss":
			return suggestionSvc.ResolvePrompt(ctx, domain.ID(requiredActionArg(args, "id")), "dismissed")
		case "suggestion-suppress":
			return suggestionSvc.SuppressPrompt(ctx, domain.ID(requiredActionArg(args, "id")))
		default:
			return nil, fmt.Errorf("unsupported assistant action %q", action.Command)
		}
	}
	if s.UOW != nil {
		var out any
		err := s.UOW.WithinTx(ctx, func(txStores ports.Stores) error {
			merged := mergeStores(stores, txStores)
			var err error
			out, err = run(merged)
			return err
		})
		return out, err
	}
	return run(stores)
}

func mergeStores(base, tx ports.Stores) ports.Stores {
	if tx.People != nil {
		base.People = tx.People
	}
	if tx.Companies != nil {
		base.Companies = tx.Companies
	}
	if tx.Deals != nil {
		base.Deals = tx.Deals
	}
	if tx.Relationships != nil {
		base.Relationships = tx.Relationships
	}
	if tx.Activities != nil {
		base.Activities = tx.Activities
	}
	if tx.Tags != nil {
		base.Tags = tx.Tags
	}
	if tx.Workspaces != nil {
		base.Workspaces = tx.Workspaces
	}
	if tx.Todos != nil {
		base.Todos = tx.Todos
	}
	if tx.Prompts != nil {
		base.Prompts = tx.Prompts
	}
	if tx.EmailMessages != nil {
		base.EmailMessages = tx.EmailMessages
	}
	return base
}

func assistantActionArgs(raw []string) map[string]string {
	out := map[string]string{}
	for _, arg := range raw {
		key, value, ok := strings.Cut(arg, "=")
		if !ok || strings.TrimSpace(key) == "" {
			continue
		}
		key = strings.TrimSpace(key)
		if key == "due" {
			key = "due_at"
		}
		out[key] = strings.TrimSpace(value)
	}
	return out
}

func validateAssistantActionArgs(command string, args map[string]string) error {
	required := map[string][]string{
		"person-update":           {"id"},
		"company-update":          {"id"},
		"deal-update":             {"id"},
		"link-person-company":     {"person_id", "company_id"},
		"unlink-person-company":   {"person_id", "company_id"},
		"link-deal-person":        {"deal_id", "person_id"},
		"unlink-deal-person":      {"deal_id", "person_id"},
		"link-deal-company":       {"deal_id", "company_id"},
		"unlink-deal-company":     {"deal_id", "company_id"},
		"activity-update":         {"id"},
		"note-update":             {"id"},
		"tag-create":              {"name"},
		"tag-attach":              {"tag_id", "entity_type", "entity_id"},
		"workspace-create":        {"name"},
		"workspace-link":          {"workspace_id", "entity_type", "entity_id"},
		"task-update":             {"id"},
		"task-complete":           {"id"},
		"suggestion-create":       {"title"},
		"suggestion-accept":       {"id"},
		"suggestion-link-person":  {"id", "person_id"},
		"suggestion-link-company": {"id", "company_id"},
		"suggestion-dismiss":      {"id"},
		"suggestion-suppress":     {"id"},
	}
	for _, key := range required[command] {
		if strings.TrimSpace(args[key]) == "" {
			return fmt.Errorf("%w: missing %s", ErrValidation, key)
		}
	}
	return nil
}

func requiredActionArg(args map[string]string, key string) string {
	return strings.TrimSpace(args[key])
}

func personFromArgs(args map[string]string, p domain.Person) domain.Person {
	if args["id"] != "" {
		p.ID = domain.ID(args["id"])
	}
	if args["first_name"] != "" {
		p.FirstName = args["first_name"]
	}
	if args["last_name"] != "" {
		p.LastName = args["last_name"]
	}
	if args["email"] != "" {
		p.Email = args["email"]
	}
	if args["phone"] != "" {
		p.Phone = args["phone"]
	}
	if args["title"] != "" {
		p.Title = args["title"]
	}
	if args["linkedin_url"] != "" {
		p.LinkedInURL = args["linkedin_url"]
	}
	if args["city"] != "" {
		p.City = args["city"]
	}
	if args["status"] != "" {
		p.Status = args["status"]
	}
	if args["source"] != "" {
		p.Source = args["source"]
	}
	if args["my_turn"] != "" {
		p.MyTurn = args["my_turn"] == "true"
	}
	return p
}

func companyFromArgs(args map[string]string, c domain.Company) domain.Company {
	if args["id"] != "" {
		c.ID = domain.ID(args["id"])
	}
	if args["name"] != "" {
		c.Name = args["name"]
	}
	if args["domain"] != "" {
		c.Domain = args["domain"]
	}
	return c
}

func dealFromArgs(args map[string]string, d domain.Deal) domain.Deal {
	if args["id"] != "" {
		d.ID = domain.ID(args["id"])
	}
	if args["workspace_id"] != "" {
		d.WorkspaceID = domain.ID(args["workspace_id"])
	}
	if args["name"] != "" {
		d.Name = args["name"]
	}
	if args["title"] != "" {
		d.Name = args["title"]
	}
	if args["stage"] != "" {
		d.Stage = args["stage"]
	}
	if args["value_cents"] != "" {
		fmt.Sscanf(args["value_cents"], "%d", &d.ValueCents)
	}
	if args["currency"] != "" {
		d.Currency = normalizeCurrencyCode(args["currency"])
	}
	return d
}

func activityFromArgs(args map[string]string, a domain.Activity) domain.Activity {
	if args["id"] != "" {
		a.ID = domain.ID(args["id"])
	}
	if args["type"] != "" {
		a.Type = domain.ActivityType(args["type"])
	}
	if args["body"] != "" {
		a.Body = args["body"]
	}
	if args["occurred_at"] != "" {
		if t, err := time.Parse(time.RFC3339, args["occurred_at"]); err == nil {
			a.OccurredAt = t
		}
	}
	return a
}

func todoFromArgs(args map[string]string, t domain.Todo) domain.Todo {
	if args["id"] != "" {
		t.ID = domain.ID(args["id"])
	}
	if args["workspace_id"] != "" {
		t.WorkspaceID = domain.ID(args["workspace_id"])
	}
	if args["entity_type"] != "" {
		t.EntityType = domain.EntityType(args["entity_type"])
	}
	if args["entity_id"] != "" {
		t.EntityID = domain.ID(args["entity_id"])
	}
	if args["title"] != "" {
		t.Title = args["title"]
	}
	if args["body"] != "" {
		t.Body = args["body"]
	}
	if args["priority"] != "" {
		t.Priority = domain.TodoPriority(args["priority"])
	}
	if args["status"] != "" {
		t.Status = domain.TodoStatus(args["status"])
	}
	if args["due_at"] != "" {
		if due, ok := parseAssistantDue(args["due_at"]); ok {
			t.DueAt = &due
		}
	}
	return t
}

func parseAssistantDue(value string) (time.Time, bool) {
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return t, true
	}
	if t, err := time.Parse("2006-01-02", value); err == nil {
		return time.Date(t.Year(), t.Month(), t.Day(), 17, 0, 0, 0, time.Local), true
	}
	base := time.Now().Local()
	base = time.Date(base.Year(), base.Month(), base.Day(), 17, 0, 0, 0, base.Location())
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "today":
		return base, true
	case "tomorrow":
		return base.AddDate(0, 0, 1), true
	}
	var amount float64
	var unit string
	if _, err := fmt.Sscanf(strings.ToLower(value), "in %f %s", &amount, &unit); err == nil {
		days := amount
		if strings.HasPrefix(unit, "week") {
			days *= 7
		}
		return base.Add(time.Duration(days * float64(24*time.Hour))), true
	}
	return time.Time{}, false
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func allowedAssistantAction(command string) bool {
	switch command {
	case "person-create", "person-update",
		"company-create", "company-update",
		"deal-create", "deal-update",
		"link-person-company", "unlink-person-company", "link-deal-person", "unlink-deal-person", "link-deal-company", "unlink-deal-company",
		"activity-create", "activity-update", "note-update", "tag-create", "tag-attach",
		"workspace-create", "workspace-link",
		"task-create", "task-update", "task-complete",
		"email-sync",
		"suggestion-create", "suggestion-accept", "suggestion-link-person", "suggestion-link-company", "suggestion-dismiss", "suggestion-suppress":
		return true
	default:
		return false
	}
}

func truncatePromptText(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}

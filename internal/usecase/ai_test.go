package usecase

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"crme/internal/domain"
	"crme/internal/ports"
)

type aiPromptStoreFake struct{}

func (aiPromptStoreFake) CreateAIPrompt(ctx context.Context, p domain.AIPrompt) (domain.AIPrompt, error) {
	return p, nil
}
func (aiPromptStoreFake) GetAIPrompt(ctx context.Context, id domain.ID) (domain.AIPrompt, error) {
	return domain.AIPrompt{ID: id, Kind: domain.PromptNewContact, Title: "New contact: ada@example.com", Body: "Name: Ada Lovelace", Status: "open"}, nil
}
func (aiPromptStoreFake) AIPromptExists(ctx context.Context, kind domain.AIPromptKind, title string, status string) (bool, error) {
	return false, nil
}
func (aiPromptStoreFake) IsSuggestionSuppressed(ctx context.Context, kind domain.AIPromptKind, targetType string, targetIdentifier string) (bool, error) {
	return false, nil
}
func (aiPromptStoreFake) SuppressSuggestion(ctx context.Context, kind domain.AIPromptKind, targetType string, targetIdentifier string, reason string) error {
	return nil
}
func (aiPromptStoreFake) UnsuppressSuggestion(ctx context.Context, kind domain.AIPromptKind, targetType string, targetIdentifier string) error {
	return nil
}
func (aiPromptStoreFake) ListAIPrompts(ctx context.Context, status string, limit int) ([]domain.AIPrompt, error) {
	return nil, nil
}
func (aiPromptStoreFake) ResolveAIPrompt(ctx context.Context, id domain.ID, status string) (domain.AIPrompt, error) {
	return domain.AIPrompt{}, nil
}

type aiPersonStoreFake struct{}

func (aiPersonStoreFake) CreatePerson(ctx context.Context, p domain.Person) (domain.Person, error) {
	p.ID = "person-1"
	return p, nil
}
func (aiPersonStoreFake) GetPerson(ctx context.Context, id domain.ID) (domain.Person, error) {
	return domain.Person{ID: id}, nil
}
func (aiPersonStoreFake) UpdatePerson(ctx context.Context, p domain.Person) (domain.Person, error) {
	return p, nil
}
func (aiPersonStoreFake) DeletePerson(ctx context.Context, id domain.ID) error { return nil }
func (aiPersonStoreFake) ListPeople(ctx context.Context, query string, workspaceID domain.ID, limit, offset int) ([]domain.Person, error) {
	return nil, nil
}
func (aiPersonStoreFake) FindPersonByEmail(ctx context.Context, email string) (domain.Person, bool, error) {
	return domain.Person{}, false, nil
}
func (aiPersonStoreFake) AddPersonEmail(ctx context.Context, personID domain.ID, email string, primary bool) error {
	return nil
}
func (aiPersonStoreFake) TouchPerson(ctx context.Context, id domain.ID, at time.Time) error {
	return nil
}

type aiCompanyStoreFake struct{}

func (aiCompanyStoreFake) CreateCompany(ctx context.Context, c domain.Company) (domain.Company, error) {
	return c, nil
}
func (aiCompanyStoreFake) GetCompany(ctx context.Context, id domain.ID) (domain.Company, error) {
	return domain.Company{ID: id}, nil
}
func (aiCompanyStoreFake) UpdateCompany(ctx context.Context, c domain.Company) (domain.Company, error) {
	return c, nil
}
func (aiCompanyStoreFake) DeleteCompany(ctx context.Context, id domain.ID) error { return nil }
func (aiCompanyStoreFake) ListCompanies(ctx context.Context, query string, workspaceID domain.ID, limit, offset int) ([]domain.Company, error) {
	return nil, nil
}
func (aiCompanyStoreFake) ListCompaniesForPerson(ctx context.Context, personID domain.ID, limit int) ([]domain.Company, error) {
	return nil, nil
}
func (aiCompanyStoreFake) ListPeopleForCompany(ctx context.Context, companyID domain.ID, limit int) ([]domain.Person, error) {
	return nil, nil
}
func (aiCompanyStoreFake) FindCompanyByDomain(ctx context.Context, domainName string) (domain.Company, bool, error) {
	return domain.Company{}, false, nil
}
func (aiCompanyStoreFake) AddCompanyDomain(ctx context.Context, companyID domain.ID, domainName string, primary bool) error {
	return nil
}
func (aiCompanyStoreFake) TouchCompany(ctx context.Context, id domain.ID, at time.Time) error {
	return nil
}

type aiRelationshipStoreFake struct{}

func (aiRelationshipStoreFake) LinkPersonCompany(ctx context.Context, personID, companyID domain.ID, role string) error {
	return nil
}
func (aiRelationshipStoreFake) UnlinkPersonCompany(ctx context.Context, personID, companyID domain.ID) error {
	return nil
}

type aiActivityStoreFake struct{ createErr error }

func (f aiActivityStoreFake) CreateActivity(ctx context.Context, a domain.Activity, links []domain.ActivityLink) (domain.Activity, error) {
	return a, f.createErr
}
func (aiActivityStoreFake) GetActivity(ctx context.Context, id domain.ID) (domain.Activity, error) {
	return domain.Activity{}, nil
}
func (aiActivityStoreFake) UpdateActivity(ctx context.Context, a domain.Activity) (domain.Activity, error) {
	return a, nil
}
func (aiActivityStoreFake) DeleteActivity(ctx context.Context, id domain.ID) error { return nil }
func (aiActivityStoreFake) LinkActivity(ctx context.Context, activityID domain.ID, entityType domain.EntityType, entityID domain.ID) error {
	return nil
}
func (aiActivityStoreFake) CreateActivityDetail(ctx context.Context, detail domain.ActivityDetail) error {
	return nil
}
func (aiActivityStoreFake) ListTimeline(ctx context.Context, entityType domain.EntityType, entityID domain.ID, limit int) ([]domain.TimelineItem, error) {
	return nil, nil
}
func (aiActivityStoreFake) ListNotes(ctx context.Context, limit int) ([]domain.TimelineItem, error) {
	return nil, nil
}

type aiTodoStoreFake struct{ created bool }

func (f *aiTodoStoreFake) CreateTodo(ctx context.Context, t domain.Todo) (domain.Todo, error) {
	f.created = true
	return t, nil
}
func (f *aiTodoStoreFake) GetTodo(ctx context.Context, id domain.ID) (domain.Todo, error) {
	return domain.Todo{ID: id, Title: "Existing", Status: domain.TodoOpen, Priority: domain.TodoPriorityNormal}, nil
}
func (f *aiTodoStoreFake) UpdateTodo(ctx context.Context, t domain.Todo) (domain.Todo, error) {
	return t, nil
}
func (f *aiTodoStoreFake) CompleteTodo(ctx context.Context, id domain.ID) (domain.Todo, error) {
	return domain.Todo{ID: id, Status: domain.TodoDone}, nil
}
func (f *aiTodoStoreFake) DeleteTodo(ctx context.Context, id domain.ID) error { return nil }
func (f *aiTodoStoreFake) ListTodos(ctx context.Context, query, status, due string, entityType domain.EntityType, entityID domain.ID, workspaceID domain.ID, limit, offset int) ([]domain.Todo, error) {
	return nil, nil
}
func (f *aiTodoStoreFake) ListActionItems(ctx context.Context, limit int) ([]domain.Todo, error) {
	return nil, nil
}

type aiSearchStoreFake struct{}

func (aiSearchStoreFake) Search(ctx context.Context, query string, limit int) ([]domain.SearchResult, error) {
	return []domain.SearchResult{{EntityType: domain.EntityCompany, EntityID: "company-1", Title: "MedSolve", Subtitle: "medsolve.de"}}, nil
}

type aiCompleterFake struct {
	responses []string
	requests  []domain.AICompletionRequest
}

func (f *aiCompleterFake) Complete(ctx context.Context, req domain.AICompletionRequest) (domain.AICompletion, error) {
	f.requests = append(f.requests, req)
	if len(f.responses) == 0 {
		return domain.AICompletion{Text: `{"type":"final","text":"No response."}`}, nil
	}
	out := f.responses[0]
	f.responses = f.responses[1:]
	return domain.AICompletion{Text: out}, nil
}

type aiEmailMessageStoreFake struct{}

func (aiEmailMessageStoreFake) UpsertEmailMessage(ctx context.Context, m domain.EmailMessage) (bool, error) {
	return false, nil
}
func (aiEmailMessageStoreFake) SetEmailMessageActivity(ctx context.Context, messageID string, activityID domain.ID) error {
	return nil
}
func (aiEmailMessageStoreFake) ListEmailMessagesForAddress(ctx context.Context, email string, limit int) ([]domain.EmailMessage, error) {
	return []domain.EmailMessage{{MessageID: "m1", Subject: "Hi", SentAt: time.Now()}}, nil
}
func (aiEmailMessageStoreFake) ListEmailMessagesForDomain(ctx context.Context, domain string, limit int) ([]domain.EmailMessage, error) {
	return nil, nil
}

type aiUOWFake struct {
	activityErr error
	committed   bool
}

func (u *aiUOWFake) WithinTx(ctx context.Context, fn func(stores ports.Stores) error) error {
	err := fn(ports.Stores{Prompts: aiPromptStoreFake{}, People: aiPersonStoreFake{}, Companies: aiCompanyStoreFake{}, Relationships: aiRelationshipStoreFake{}, Activities: aiActivityStoreFake{createErr: u.activityErr}, EmailMessages: aiEmailMessageStoreFake{}})
	if err == nil {
		u.committed = true
	}
	return err
}

func TestChatRunsReadOnlyToolBeforeFinalAction(t *testing.T) {
	ai := &aiCompleterFake{responses: []string{
		`{"type":"tool_call","tool":"crm.search","args":{"q":"medsolve","limit":5}}`,
		`{"type":"final","text":"Create this deal and link MedSolve?","pending_action":{"command":"deal-create","args":["name=SkillTops","stage=proposal","value_cents=500000","currency=EUR","company_id=company-1"]}}`,
	}}
	svc := AIService{Search: aiSearchStoreFake{}, AI: ai}
	out, err := svc.Chat(context.Background(), []domain.AIMessage{{Role: "user", Content: "Create a deal for medsolve"}})
	if err != nil {
		t.Fatalf("chat failed: %v", err)
	}
	if out.PendingAction == nil || out.PendingAction.Command != "deal-create" {
		t.Fatalf("expected deal-create pending action, got %#v", out.PendingAction)
	}
	if len(ai.requests) != 2 {
		t.Fatalf("expected two AI calls, got %d", len(ai.requests))
	}
	lastMessages := ai.requests[1].Messages
	if got := lastMessages[len(lastMessages)-1].Content; !strings.Contains(got, "MedSolve") {
		t.Fatalf("expected tool result in second request, got %q", got)
	}
}

func TestChatDoesNotTreatActionResultAsEntityRetrieval(t *testing.T) {
	ai := &aiCompleterFake{responses: []string{`{"type":"final","text":"Done."}`}}
	svc := AIService{Search: aiSearchStoreFake{}, AI: ai}
	out, err := svc.Chat(context.Background(), []domain.AIMessage{
		{Role: "user", Content: "Confirm"},
		{Role: "user", Content: `ACTION_RESULT:
task-create succeeded.
Result: {"status":"open","title":"Send Thomas infos about Aeon"}
Continue the original request if more confirmed steps are needed. If the workflow is complete, say so briefly.`},
	})
	if err != nil {
		t.Fatalf("chat failed: %v", err)
	}
	if out.Text != "Done." {
		t.Fatalf("expected AI completion, got %q", out.Text)
	}
	if len(out.Entities) != 0 {
		t.Fatalf("expected no retrieval entities, got %#v", out.Entities)
	}
	if len(ai.requests) != 1 {
		t.Fatalf("expected one AI call, got %d", len(ai.requests))
	}
}

func TestExecuteActionUsesTodoUsecaseValidation(t *testing.T) {
	todos := &aiTodoStoreFake{}
	svc := AIService{Todos: todos}
	_, err := svc.ExecuteAction(context.Background(), domain.AIAction{Command: "task-create", Args: []string{"body=missing title"}})
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
	if todos.created {
		t.Fatal("expected assistant action to use CRMService validation before store create")
	}
}

func TestExecuteActionReturnsValidationForMissingRequiredArg(t *testing.T) {
	svc := AIService{}
	_, err := svc.ExecuteAction(context.Background(), domain.AIAction{Command: "person-update"})
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
	if !strings.Contains(err.Error(), "missing id") {
		t.Fatalf("expected missing id error, got %v", err)
	}
}

func TestAcceptPromptRollbackOnHistoricalEmailLinkFailure(t *testing.T) {
	boom := errors.New("activity failed")
	uow := &aiUOWFake{activityErr: boom}
	svc := SuggestionService{UOW: uow}
	_, err := svc.AcceptPrompt(context.Background(), "prompt-1")
	if !errors.Is(err, boom) {
		t.Fatalf("expected activity error, got %v", err)
	}
	if uow.committed {
		t.Fatal("expected transaction not to commit")
	}
}

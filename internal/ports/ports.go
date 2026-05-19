package ports

import (
	"context"
	"time"

	"crme/internal/domain"
)

type AuthStore interface {
	HasUsers(ctx context.Context) (bool, error)
	CreateUser(ctx context.Context, email, role string, active bool) (domain.ID, error)
	ActiveUserByEmail(ctx context.Context, email string) (domain.ID, bool, error)
	CreateMagicLink(ctx context.Context, email, tokenHash string, expiresAt time.Time) error
	ConsumeMagicLink(ctx context.Context, tokenHash string, now time.Time) (email string, err error)
	CreateSession(ctx context.Context, userID domain.ID, email, tokenHash string, expiresAt time.Time) error
	ValidateSession(ctx context.Context, tokenHash string, now time.Time) (email string, err error)
	RevokeSession(ctx context.Context, tokenHash string, now time.Time) error
	ListAPITokens(ctx context.Context, userID, organizationID domain.ID) ([]domain.APIToken, error)
	CreateAPIToken(ctx context.Context, token domain.APIToken, tokenHash string) (domain.APIToken, error)
	RevokeAPIToken(ctx context.Context, userID, organizationID, tokenID domain.ID, now time.Time) error
	UserByAPIToken(ctx context.Context, tokenHash string, now time.Time) (domain.User, domain.ID, string, error)
}

type MagicLinkSender interface {
	SendMagicLink(ctx context.Context, email, url string) error
}

type OrganizationStore interface {
	UserBySession(ctx context.Context, tokenHash string, now time.Time) (domain.User, error)
	ListOrganizationsForUser(ctx context.Context, userID domain.ID) ([]domain.OrganizationMembership, error)
	CreateOrganizationWithOwner(ctx context.Context, name string, ownerUserID domain.ID) (domain.Organization, error)
	ListOrganizationMembers(ctx context.Context, organizationID domain.ID) ([]domain.OrganizationMember, error)
	UpdateOrganizationMemberRole(ctx context.Context, organizationID, userID domain.ID, role string) (domain.OrganizationMember, error)
	RemoveOrganizationMember(ctx context.Context, organizationID, userID domain.ID) error
	CreateOrganizationInvitation(ctx context.Context, organizationID domain.ID, email, role, tokenHash string, expiresAt time.Time, invitedByUserID domain.ID) (domain.OrganizationInvitation, error)
	ListOrganizationInvitations(ctx context.Context, organizationID domain.ID) ([]domain.OrganizationInvitation, error)
	GetOrganizationInvitation(ctx context.Context, tokenHash string, now time.Time) (domain.OrganizationInvitation, error)
	UpdateOrganizationInvitationToken(ctx context.Context, organizationID, invitationID domain.ID, tokenHash string, expiresAt time.Time) (domain.OrganizationInvitation, error)
	AcceptOrganizationInvitation(ctx context.Context, tokenHash string, now time.Time, userID domain.ID) (domain.OrganizationInvitation, error)
}

type RuntimeSecretStore interface {
	CreateRuntimeSecret(ctx context.Context, scope, name string, ciphertext, nonce []byte) (domain.ID, error)
	GetRuntimeSecret(ctx context.Context, id domain.ID) (scope, name string, ciphertext, nonce []byte, err error)
}

type AuditLogStore interface {
	CreateAuditLog(ctx context.Context, log domain.AuditLog) (domain.AuditLog, error)
	ListAuditLogs(ctx context.Context, organizationID domain.ID, limit, offset int) ([]domain.AuditLog, error)
}

type AdminStore interface {
	AdminStats(ctx context.Context, organizationID domain.ID) (domain.AdminStats, error)
}

type MailFetcher interface {
	FetchNewMessages(ctx context.Context, account domain.EmailAccount, secret string, since time.Time, limit int) ([]domain.EmailMessage, error)
}

type EmailAccountTester interface {
	TestEmailAccount(ctx context.Context, account domain.EmailAccount, secret string) error
}

type SecretResolver interface {
	Resolve(ctx context.Context, ref string) (string, error)
}

type PersonStore interface {
	CreatePerson(ctx context.Context, p domain.Person) (domain.Person, error)
	GetPerson(ctx context.Context, id domain.ID) (domain.Person, error)
	UpdatePerson(ctx context.Context, p domain.Person) (domain.Person, error)
	DeletePerson(ctx context.Context, id domain.ID) error
	ListPeople(ctx context.Context, query string, workspaceID domain.ID, limit, offset int) ([]domain.Person, error)
	FindPersonByEmail(ctx context.Context, email string) (domain.Person, bool, error)
	AddPersonEmail(ctx context.Context, personID domain.ID, email string, primary bool) error
	TouchPerson(ctx context.Context, id domain.ID, at time.Time) error
}

type CompanyStore interface {
	CreateCompany(ctx context.Context, c domain.Company) (domain.Company, error)
	GetCompany(ctx context.Context, id domain.ID) (domain.Company, error)
	UpdateCompany(ctx context.Context, c domain.Company) (domain.Company, error)
	DeleteCompany(ctx context.Context, id domain.ID) error
	ListCompanies(ctx context.Context, query string, workspaceID domain.ID, limit, offset int) ([]domain.Company, error)
	ListCompaniesForPerson(ctx context.Context, personID domain.ID, limit int) ([]domain.Company, error)
	ListPeopleForCompany(ctx context.Context, companyID domain.ID, limit int) ([]domain.Person, error)
	FindCompanyByDomain(ctx context.Context, domain string) (domain.Company, bool, error)
	AddCompanyDomain(ctx context.Context, companyID domain.ID, domain string, primary bool) error
	TouchCompany(ctx context.Context, id domain.ID, at time.Time) error
}

type DealStore interface {
	CreateDeal(ctx context.Context, d domain.Deal) (domain.Deal, error)
	GetDeal(ctx context.Context, id domain.ID) (domain.Deal, error)
	UpdateDeal(ctx context.Context, d domain.Deal) (domain.Deal, error)
	DeleteDeal(ctx context.Context, id domain.ID) error
	ListDeals(ctx context.Context, query string, workspaceID domain.ID, limit, offset int) ([]domain.Deal, error)
	LinkDealPerson(ctx context.Context, dealID, personID domain.ID) error
	UnlinkDealPerson(ctx context.Context, dealID, personID domain.ID) error
	ListPeopleForDeal(ctx context.Context, dealID domain.ID, limit int) ([]domain.Person, error)
	LinkDealCompany(ctx context.Context, dealID, companyID domain.ID) error
	UnlinkDealCompany(ctx context.Context, dealID, companyID domain.ID) error
	ListCompaniesForDeal(ctx context.Context, dealID domain.ID, limit int) ([]domain.Company, error)
}

type RelationshipStore interface {
	LinkPersonCompany(ctx context.Context, personID, companyID domain.ID, role string) error
	UnlinkPersonCompany(ctx context.Context, personID, companyID domain.ID) error
}

type ActivityStore interface {
	CreateActivity(ctx context.Context, a domain.Activity, links []domain.ActivityLink) (domain.Activity, error)
	GetActivity(ctx context.Context, id domain.ID) (domain.Activity, error)
	UpdateActivity(ctx context.Context, a domain.Activity) (domain.Activity, error)
	DeleteActivity(ctx context.Context, id domain.ID) error
	LinkActivity(ctx context.Context, activityID domain.ID, entityType domain.EntityType, entityID domain.ID) error
	CreateActivityDetail(ctx context.Context, detail domain.ActivityDetail) error
	ListTimeline(ctx context.Context, entityType domain.EntityType, entityID domain.ID, limit int) ([]domain.TimelineItem, error)
	ListNotes(ctx context.Context, limit int) ([]domain.TimelineItem, error)
}

type TagStore interface {
	CreateTag(ctx context.Context, tag domain.Tag) (domain.Tag, error)
	ListTags(ctx context.Context, limit int) ([]domain.Tag, error)
	TagEntity(ctx context.Context, tagID domain.ID, entityType domain.EntityType, entityID domain.ID) error
}

type WorkspaceStore interface {
	CreateWorkspace(ctx context.Context, workspace domain.Workspace) (domain.Workspace, error)
	ListWorkspaces(ctx context.Context, limit int) ([]domain.Workspace, error)
	LinkWorkspaceEntity(ctx context.Context, workspaceID domain.ID, entityType domain.EntityType, entityID domain.ID) error
	ListWorkspaceEntities(ctx context.Context, workspaceID domain.ID, entityType domain.EntityType, limit int) ([]domain.WorkspaceEntity, error)
}

type SearchStore interface {
	Search(ctx context.Context, query string, limit int) ([]domain.SearchResult, error)
}

type AssistantConversationStore interface {
	ListAssistantConversations(ctx context.Context, sessionID domain.ID, limit int) ([]domain.AssistantConversation, error)
	UpsertAssistantConversation(ctx context.Context, conversation domain.AssistantConversation) (domain.AssistantConversation, error)
	CleanupAssistantConversations(ctx context.Context, before time.Time) (int64, error)
}

type Stores struct {
	People                 PersonStore
	Companies              CompanyStore
	Deals                  DealStore
	Relationships          RelationshipStore
	Activities             ActivityStore
	Tags                   TagStore
	Workspaces             WorkspaceStore
	Search                 SearchStore
	Todos                  TodoStore
	Prompts                AIPromptStore
	AssistantConversations AssistantConversationStore
	EmailAccounts          EmailAccountStore
	EmailMessages          EmailMessageStore
}

type UnitOfWork interface {
	WithinTx(ctx context.Context, fn func(stores Stores) error) error
}

type TodoStore interface {
	CreateTodo(ctx context.Context, t domain.Todo) (domain.Todo, error)
	GetTodo(ctx context.Context, id domain.ID) (domain.Todo, error)
	UpdateTodo(ctx context.Context, t domain.Todo) (domain.Todo, error)
	CompleteTodo(ctx context.Context, id domain.ID) (domain.Todo, error)
	DeleteTodo(ctx context.Context, id domain.ID) error
	ListTodos(ctx context.Context, query, status, due string, entityType domain.EntityType, entityID domain.ID, workspaceID domain.ID, limit, offset int) ([]domain.Todo, error)
	ListActionItems(ctx context.Context, limit int) ([]domain.Todo, error)
}

type AIPromptStore interface {
	CreateAIPrompt(ctx context.Context, p domain.AIPrompt) (domain.AIPrompt, error)
	GetAIPrompt(ctx context.Context, id domain.ID) (domain.AIPrompt, error)
	AIPromptExists(ctx context.Context, kind domain.AIPromptKind, title string, status string) (bool, error)
	IsSuggestionSuppressed(ctx context.Context, kind domain.AIPromptKind, targetType string, targetIdentifier string) (bool, error)
	SuppressSuggestion(ctx context.Context, kind domain.AIPromptKind, targetType string, targetIdentifier string, reason string) error
	UnsuppressSuggestion(ctx context.Context, kind domain.AIPromptKind, targetType string, targetIdentifier string) error
	ListAIPrompts(ctx context.Context, status string, limit, offset int) ([]domain.AIPrompt, error)
	ResolveAIPrompt(ctx context.Context, id domain.ID, status string) (domain.AIPrompt, error)
}

type EmailAccountStore interface {
	CreateEmailAccount(ctx context.Context, a domain.EmailAccount) (domain.EmailAccount, error)
	GetEmailAccount(ctx context.Context, id domain.ID) (domain.EmailAccount, error)
	ListEmailAccounts(ctx context.Context, limit int) ([]domain.EmailAccount, error)
	UpdateEmailAccount(ctx context.Context, a domain.EmailAccount) (domain.EmailAccount, error)
	DeleteEmailAccount(ctx context.Context, id domain.ID) error
	ListSyncEnabledEmailAccounts(ctx context.Context, limit int) ([]domain.EmailAccount, error)
	MarkEmailAccountSynced(ctx context.Context, id domain.ID, at time.Time) error
}

type EmailMessageStore interface {
	UpsertEmailMessage(ctx context.Context, m domain.EmailMessage) (bool, error)
	SetEmailMessageActivity(ctx context.Context, messageID string, activityID domain.ID) error
	ListEmailMessagesForAddress(ctx context.Context, email string, limit int) ([]domain.EmailMessage, error)
	ListEmailMessagesForDomain(ctx context.Context, domain string, limit int) ([]domain.EmailMessage, error)
}

type AICompleter interface {
	Complete(ctx context.Context, req domain.AICompletionRequest) (domain.AICompletion, error)
}

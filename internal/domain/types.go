package domain

import "time"

type ID string

type EntityType string

type User struct {
	ID        ID        `json:"id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Organization struct {
	ID        ID        `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type OrganizationMembership struct {
	OrganizationID ID        `json:"organization_id"`
	UserID         ID        `json:"user_id,omitempty"`
	Role           string    `json:"role"`
	Name           string    `json:"name"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type OrganizationMember struct {
	OrganizationID ID        `json:"organization_id"`
	UserID         ID        `json:"user_id"`
	Email          string    `json:"email"`
	Role           string    `json:"role"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type OrganizationInvitation struct {
	ID               ID         `json:"id,omitempty"`
	OrganizationID   ID         `json:"organization_id,omitempty"`
	OrganizationName string     `json:"organization_name"`
	Email            string     `json:"email"`
	Role             string     `json:"role"`
	ExpiresAt        time.Time  `json:"expires_at"`
	AcceptedAt       *time.Time `json:"accepted_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at,omitempty"`
}

type APIToken struct {
	ID             ID         `json:"id"`
	OrganizationID ID         `json:"organization_id,omitempty"`
	UserID         ID         `json:"user_id,omitempty"`
	Name           string     `json:"name"`
	Token          string     `json:"token,omitempty"`
	LastUsedAt     *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type AuditLog struct {
	ID             ID             `json:"id,omitempty"`
	OrganizationID ID             `json:"organization_id,omitempty"`
	ActorUserID    ID             `json:"actor_user_id,omitempty"`
	ActorEmail     string         `json:"actor_email,omitempty"`
	Action         string         `json:"action"`
	TargetType     string         `json:"target_type,omitempty"`
	TargetID       ID             `json:"target_id,omitempty"`
	Details        map[string]any `json:"details,omitempty"`
	CreatedAt      time.Time      `json:"created_at,omitempty"`
}

type Capabilities struct {
	Role                  string `json:"role,omitempty"`
	Admin                 bool   `json:"admin"`
	CanManageOrganization bool   `json:"can_manage_organization"`
	CanManageMembers      bool   `json:"can_manage_members"`
	CanInviteMembers      bool   `json:"can_invite_members"`
	CanWriteCRM           bool   `json:"can_write_crm"`
	CanDeleteCRM          bool   `json:"can_delete_crm"`
	CanCreateOrganization bool   `json:"can_create_organization"`
}

type Me struct {
	User                  User                     `json:"user"`
	Organizations         []OrganizationMembership `json:"organizations"`
	CurrentOrganizationID ID                       `json:"current_organization_id,omitempty"`
	Capabilities          Capabilities             `json:"capabilities"`
}

type AdminStats struct {
	Users           int `json:"users"`
	Organizations   int `json:"organizations"`
	Workspaces      int `json:"workspaces"`
	People          int `json:"people"`
	Companies       int `json:"companies"`
	Deals           int `json:"deals"`
	OpenTasks       int `json:"open_tasks"`
	Tags            int `json:"tags"`
	Activities      int `json:"activities"`
	EmailAccounts   int `json:"email_accounts"`
	OpenSuggestions int `json:"open_suggestions"`
	AuditLogs       int `json:"audit_logs"`
}

const (
	EntityPerson   EntityType = "person"
	EntityCompany  EntityType = "company"
	EntityDeal     EntityType = "deal"
	EntityTodo     EntityType = "task"
	EntityActivity EntityType = "activity"
)

type Person struct {
	ID          ID         `json:"id"`
	FirstName   string     `json:"first_name"`
	LastName    string     `json:"last_name"`
	Email       string     `json:"email"`
	Phone       string     `json:"phone"`
	Title       string     `json:"title"`
	LinkedInURL string     `json:"linkedin_url"`
	City        string     `json:"city"`
	CompanyName string     `json:"company_name,omitempty"`
	Status      string     `json:"status"`
	Source      string     `json:"source"`
	MyTurn      bool       `json:"my_turn"`
	LastTouchAt *time.Time `json:"last_touch_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type Company struct {
	ID          ID         `json:"id"`
	Name        string     `json:"name"`
	Domain      string     `json:"domain"`
	LastTouchAt *time.Time `json:"last_touch_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type Tag struct {
	ID        ID        `json:"id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	CreatedAt time.Time `json:"created_at"`
}

type Workspace struct {
	ID          ID        `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type WorkspaceEntity struct {
	WorkspaceID ID         `json:"workspace_id"`
	EntityType  EntityType `json:"entity_type"`
	EntityID    ID         `json:"entity_id"`
	Title       string     `json:"title"`
	Subtitle    string     `json:"subtitle"`
}

type Deal struct {
	ID          ID        `json:"id"`
	WorkspaceID ID        `json:"workspace_id,omitempty"`
	Name        string    `json:"name"`
	Stage       string    `json:"stage"`
	ValueCents  int64     `json:"value_cents"`
	Currency    string    `json:"currency"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ActivityType string

const (
	ActivityNote    ActivityType = "note"
	ActivityCall    ActivityType = "call"
	ActivityMeeting ActivityType = "meeting"
	ActivityEmail   ActivityType = "email"
)

type Activity struct {
	ID         ID           `json:"id"`
	Type       ActivityType `json:"type"`
	Body       string       `json:"body"`
	OccurredAt time.Time    `json:"occurred_at"`
	CreatedAt  time.Time    `json:"created_at"`
}

type ActivityLink struct {
	ActivityID ID         `json:"activity_id"`
	EntityType EntityType `json:"entity_type"`
	EntityID   ID         `json:"entity_id"`
}

type TimelineItem struct {
	Kind             string       `json:"kind"`
	ID               ID           `json:"id"`
	EntityType       EntityType   `json:"entity_type"`
	EntityID         ID           `json:"entity_id"`
	Type             ActivityType `json:"type,omitempty"`
	Title            string       `json:"title,omitempty"`
	Body             string       `json:"body,omitempty"`
	PrivateBody      string       `json:"private_body,omitempty"`
	PrivateDetail    bool         `json:"private_detail,omitempty"`
	PrivateDetailOwn bool         `json:"private_detail_own,omitempty"`
	At               time.Time    `json:"at"`
}

type SearchResult struct {
	EntityType EntityType `json:"entity_type"`
	EntityID   ID         `json:"entity_id"`
	Title      string     `json:"title"`
	Subtitle   string     `json:"subtitle"`
}

type TodoStatus string

type TodoPriority string

const (
	TodoOpen TodoStatus = "open"
	TodoDone TodoStatus = "done"
)

const (
	TodoPriorityLow    TodoPriority = "low"
	TodoPriorityNormal TodoPriority = "normal"
	TodoPriorityHigh   TodoPriority = "high"
	TodoPriorityUrgent TodoPriority = "urgent"
)

type Todo struct {
	ID          ID           `json:"id"`
	WorkspaceID ID           `json:"workspace_id,omitempty"`
	EntityType  EntityType   `json:"entity_type"`
	EntityID    ID           `json:"entity_id"`
	Title       string       `json:"title"`
	Body        string       `json:"body"`
	DueAt       *time.Time   `json:"due_at,omitempty"`
	Priority    TodoPriority `json:"priority"`
	Status      TodoStatus   `json:"status"`
	CreatedAt   time.Time    `json:"created_at"`
	CompletedAt *time.Time   `json:"completed_at,omitempty"`
}

type AIPromptKind string

const (
	PromptNewContact     AIPromptKind = "new_contact"
	PromptNewCompany     AIPromptKind = "new_company"
	PromptPossibleMerge  AIPromptKind = "possible_merge"
	PromptFollowUp       AIPromptKind = "follow_up"
	PromptDealStageNudge AIPromptKind = "deal_stage_nudge"
)

type AIPrompt struct {
	ID               ID           `json:"id"`
	Kind             AIPromptKind `json:"kind"`
	EntityType       EntityType   `json:"entity_type"`
	EntityID         ID           `json:"entity_id"`
	TargetType       string       `json:"target_type,omitempty"`
	TargetIdentifier string       `json:"target_identifier,omitempty"`
	Title            string       `json:"title"`
	Body             string       `json:"body"`
	Status           string       `json:"status"`
	LastTouchAt      *time.Time   `json:"last_touch_at,omitempty"`
	CreatedAt        time.Time    `json:"created_at"`
}

type EmailMessage struct {
	ID             ID        `json:"id"`
	EmailAccountID ID        `json:"email_account_id"`
	OwnerUserID    ID        `json:"owner_user_id,omitempty"`
	ActivityID     ID        `json:"activity_id,omitempty"`
	MessageID      string    `json:"message_id"`
	ThreadKey      string    `json:"thread_key"`
	Direction      string    `json:"direction"`
	FromEmail      string    `json:"from_email"`
	FromName       string    `json:"from_name,omitempty"`
	ToEmails       []string  `json:"to_emails"`
	Subject        string    `json:"subject"`
	BodyText       string    `json:"body_text"`
	SentAt         time.Time `json:"sent_at"`
	CreatedAt      time.Time `json:"created_at"`
}

type EmailAccount struct {
	ID             ID         `json:"id"`
	OrganizationID ID         `json:"organization_id,omitempty"`
	OwnerUserID    ID         `json:"owner_user_id,omitempty"`
	Name           string     `json:"name"`
	Email          string     `json:"email"`
	IMAPHost       string     `json:"imap_host"`
	IMAPPort       int        `json:"imap_port"`
	IMAPUsername   string     `json:"imap_username"`
	SMTPHost       string     `json:"smtp_host"`
	SMTPPort       int        `json:"smtp_port"`
	SMTPUsername   string     `json:"smtp_username"`
	SecretRef      string     `json:"secret_ref"`
	Secret         string     `json:"secret,omitempty"`
	SyncEnabled    bool       `json:"sync_enabled"`
	LastSyncedAt   *time.Time `json:"last_synced_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type ActivityDetail struct {
	ActivityID  ID        `json:"activity_id"`
	OwnerUserID ID        `json:"owner_user_id"`
	BodyText    string    `json:"body_text"`
	CreatedAt   time.Time `json:"created_at"`
}

type AIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type AICompletionRequest struct {
	System   string      `json:"system"`
	Messages []AIMessage `json:"messages"`
}

type AssistantConversation struct {
	ID            ID          `json:"id"`
	SessionID     ID          `json:"-"`
	Title         string      `json:"title"`
	Messages      []AIMessage `json:"messages"`
	PendingAction *AIAction   `json:"pending_action,omitempty"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
}

type AIAction struct {
	Command string   `json:"command"`
	Args    []string `json:"args,omitempty"`
}

type AICompletion struct {
	Text          string         `json:"text"`
	PendingAction *AIAction      `json:"pending_action,omitempty"`
	Entities      []SearchResult `json:"entities,omitempty"`
}

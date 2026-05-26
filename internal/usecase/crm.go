package usecase

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"crme/internal/domain"
	"crme/internal/ports"
)

type CRMService struct {
	UOW           ports.UnitOfWork
	People        ports.PersonStore
	Companies     ports.CompanyStore
	Deals         ports.DealStore
	Relationships ports.RelationshipStore
	Activities    ports.ActivityStore
	Tags          ports.TagStore
	Workspaces    ports.WorkspaceStore
	SearchStore   ports.SearchStore
	Todos         ports.TodoStore
}

func (s CRMService) CreatePerson(ctx context.Context, p domain.Person) (domain.Person, error) {
	p.FirstName = strings.TrimSpace(p.FirstName)
	p.LastName = strings.TrimSpace(p.LastName)
	if p.FirstName == "" && p.LastName == "" {
		return p, fmt.Errorf("%w: person name is required", ErrValidation)
	}
	p.Email = strings.ToLower(strings.TrimSpace(p.Email))
	return s.People.CreatePerson(ctx, p)
}
func (s CRMService) CreatePersonInWorkspace(ctx context.Context, p domain.Person, workspaceID domain.ID) (domain.Person, error) {
	if workspaceID == "" || s.UOW == nil {
		created, err := s.CreatePerson(ctx, p)
		if err != nil || workspaceID == "" {
			return created, err
		}
		return created, s.Workspaces.LinkWorkspaceEntity(ctx, workspaceID, domain.EntityPerson, created.ID)
	}
	p.FirstName = strings.TrimSpace(p.FirstName)
	p.LastName = strings.TrimSpace(p.LastName)
	if p.FirstName == "" && p.LastName == "" {
		return p, fmt.Errorf("%w: person name is required", ErrValidation)
	}
	p.Email = strings.ToLower(strings.TrimSpace(p.Email))
	var created domain.Person
	err := s.UOW.WithinTx(ctx, func(stores ports.Stores) error {
		var err error
		created, err = stores.People.CreatePerson(ctx, p)
		if err != nil {
			return err
		}
		return stores.Workspaces.LinkWorkspaceEntity(ctx, workspaceID, domain.EntityPerson, created.ID)
	})
	return created, err
}
func (s CRMService) GetPerson(ctx context.Context, id domain.ID) (domain.Person, error) {
	return s.People.GetPerson(ctx, id)
}
func (s CRMService) UpdatePerson(ctx context.Context, p domain.Person) (domain.Person, error) {
	existing, err := s.People.GetPerson(ctx, p.ID)
	if err != nil {
		return p, err
	}
	if p.FirstName == "" {
		p.FirstName = existing.FirstName
	}
	if p.LastName == "" {
		p.LastName = existing.LastName
	}
	if p.Email == "" {
		p.Email = existing.Email
	}
	if p.Phone == "" {
		p.Phone = existing.Phone
	}
	if p.Title == "" {
		p.Title = existing.Title
	}
	if p.LinkedInURL == "" {
		p.LinkedInURL = existing.LinkedInURL
	}
	if p.City == "" {
		p.City = existing.City
	}
	if p.Status == "" {
		p.Status = existing.Status
	}
	if p.Source == "" {
		p.Source = existing.Source
	}
	if p.LastTouchAt == nil {
		p.LastTouchAt = existing.LastTouchAt
	}
	p.Email = strings.ToLower(strings.TrimSpace(p.Email))
	return s.People.UpdatePerson(ctx, p)
}
func (s CRMService) ReplacePerson(ctx context.Context, p domain.Person) (domain.Person, error) {
	p.Email = strings.ToLower(strings.TrimSpace(p.Email))
	return s.People.UpdatePerson(ctx, p)
}
func (s CRMService) DeletePerson(ctx context.Context, id domain.ID) error {
	return s.People.DeletePerson(ctx, id)
}
func (s CRMService) ListPeople(ctx context.Context, query string, workspaceID domain.ID, limit, offset int) ([]domain.Person, error) {
	return s.People.ListPeople(ctx, strings.TrimSpace(query), workspaceID, saneLimit(limit), saneOffset(offset))
}
func (s CRMService) AddPersonEmail(ctx context.Context, personID domain.ID, email string, primary bool) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if personID == "" || email == "" || !strings.Contains(email, "@") {
		return fmt.Errorf("%w: person and valid email are required", ErrValidation)
	}
	return s.People.AddPersonEmail(ctx, personID, email, primary)
}
func (s CRMService) TouchPerson(ctx context.Context, id domain.ID, at time.Time) error {
	if id == "" {
		return fmt.Errorf("%w: person id is required", ErrValidation)
	}
	return s.People.TouchPerson(ctx, id, at)
}
func (s CRMService) CreateCompany(ctx context.Context, c domain.Company) (domain.Company, error) {
	c.Name = strings.TrimSpace(c.Name)
	if c.Name == "" {
		return c, fmt.Errorf("%w: company name is required", ErrValidation)
	}
	c.Domain = strings.ToLower(strings.TrimSpace(c.Domain))
	return s.Companies.CreateCompany(ctx, c)
}
func (s CRMService) CreateCompanyInWorkspace(ctx context.Context, c domain.Company, workspaceID domain.ID) (domain.Company, error) {
	if workspaceID == "" || s.UOW == nil {
		created, err := s.CreateCompany(ctx, c)
		if err != nil || workspaceID == "" {
			return created, err
		}
		return created, s.Workspaces.LinkWorkspaceEntity(ctx, workspaceID, domain.EntityCompany, created.ID)
	}
	c.Domain = strings.ToLower(strings.TrimSpace(c.Domain))
	var created domain.Company
	err := s.UOW.WithinTx(ctx, func(stores ports.Stores) error {
		var err error
		created, err = stores.Companies.CreateCompany(ctx, c)
		if err != nil {
			return err
		}
		return stores.Workspaces.LinkWorkspaceEntity(ctx, workspaceID, domain.EntityCompany, created.ID)
	})
	return created, err
}
func (s CRMService) GetCompany(ctx context.Context, id domain.ID) (domain.Company, error) {
	return s.Companies.GetCompany(ctx, id)
}
func (s CRMService) UpdateCompany(ctx context.Context, c domain.Company) (domain.Company, error) {
	existing, err := s.Companies.GetCompany(ctx, c.ID)
	if err != nil {
		return c, err
	}
	if c.Name == "" {
		c.Name = existing.Name
	}
	if c.Domain == "" {
		c.Domain = existing.Domain
	}
	if c.LastTouchAt == nil {
		c.LastTouchAt = existing.LastTouchAt
	}
	c.Domain = strings.ToLower(strings.TrimSpace(c.Domain))
	return s.Companies.UpdateCompany(ctx, c)
}
func (s CRMService) DeleteCompany(ctx context.Context, id domain.ID) error {
	return s.Companies.DeleteCompany(ctx, id)
}
func (s CRMService) ListCompanies(ctx context.Context, query string, workspaceID domain.ID, limit, offset int) ([]domain.Company, error) {
	return s.Companies.ListCompanies(ctx, strings.TrimSpace(query), workspaceID, saneLimit(limit), saneOffset(offset))
}
func (s CRMService) ListCompaniesForPerson(ctx context.Context, personID domain.ID, limit int) ([]domain.Company, error) {
	return s.Companies.ListCompaniesForPerson(ctx, personID, saneLimit(limit))
}
func (s CRMService) ListPeopleForCompany(ctx context.Context, companyID domain.ID, limit int) ([]domain.Person, error) {
	return s.Companies.ListPeopleForCompany(ctx, companyID, saneLimit(limit))
}
func (s CRMService) AddCompanyDomain(ctx context.Context, companyID domain.ID, domainName string, primary bool) error {
	domainName = strings.ToLower(strings.TrimSpace(domainName))
	if companyID == "" || domainName == "" {
		return fmt.Errorf("%w: company and domain are required", ErrValidation)
	}
	return s.Companies.AddCompanyDomain(ctx, companyID, domainName, primary)
}
func (s CRMService) TouchCompany(ctx context.Context, id domain.ID, at time.Time) error {
	if id == "" {
		return fmt.Errorf("%w: company id is required", ErrValidation)
	}
	return s.Companies.TouchCompany(ctx, id, at)
}
func (s CRMService) CreateDeal(ctx context.Context, d domain.Deal) (domain.Deal, error) {
	d.Name = strings.TrimSpace(d.Name)
	if d.Name == "" {
		return d, fmt.Errorf("%w: deal name is required", ErrValidation)
	}
	d.Currency = normalizeCurrencyCode(d.Currency)
	if d.Stage == "" {
		d.Stage = "new"
	}
	return s.Deals.CreateDeal(ctx, d)
}
func (s CRMService) GetDeal(ctx context.Context, id domain.ID) (domain.Deal, error) {
	return s.Deals.GetDeal(ctx, id)
}
func (s CRMService) UpdateDeal(ctx context.Context, d domain.Deal) (domain.Deal, error) {
	d.Currency = normalizeCurrencyCode(d.Currency)
	return s.Deals.UpdateDeal(ctx, d)
}
func (s CRMService) DeleteDeal(ctx context.Context, id domain.ID) error {
	return s.Deals.DeleteDeal(ctx, id)
}
func (s CRMService) ListDeals(ctx context.Context, query string, workspaceID domain.ID, limit, offset int) ([]domain.Deal, error) {
	return s.Deals.ListDeals(ctx, strings.TrimSpace(query), workspaceID, saneLimit(limit), saneOffset(offset))
}

var currencyCodePattern = regexp.MustCompile(`^[A-Z]{3}$`)

func normalizeCurrencyCode(value string) string {
	code := strings.ToUpper(strings.TrimSpace(value))
	if currencyCodePattern.MatchString(code) {
		return code
	}
	return "USD"
}
func (s CRMService) LinkPersonCompany(ctx context.Context, personID, companyID domain.ID, role string) error {
	return s.Relationships.LinkPersonCompany(ctx, personID, companyID, role)
}
func (s CRMService) UnlinkPersonCompany(ctx context.Context, personID, companyID domain.ID) error {
	return s.Relationships.UnlinkPersonCompany(ctx, personID, companyID)
}
func (s CRMService) LinkDealPerson(ctx context.Context, dealID, personID domain.ID) error {
	return s.Deals.LinkDealPerson(ctx, dealID, personID)
}
func (s CRMService) UnlinkDealPerson(ctx context.Context, dealID, personID domain.ID) error {
	return s.Deals.UnlinkDealPerson(ctx, dealID, personID)
}
func (s CRMService) ListDealsForPerson(ctx context.Context, personID domain.ID, limit int) ([]domain.Deal, error) {
	return s.Deals.ListDealsForPerson(ctx, personID, saneLimit(limit))
}
func (s CRMService) ListPeopleForDeal(ctx context.Context, dealID domain.ID, limit int) ([]domain.Person, error) {
	return s.Deals.ListPeopleForDeal(ctx, dealID, saneLimit(limit))
}
func (s CRMService) LinkDealCompany(ctx context.Context, dealID, companyID domain.ID) error {
	return s.Deals.LinkDealCompany(ctx, dealID, companyID)
}
func (s CRMService) UnlinkDealCompany(ctx context.Context, dealID, companyID domain.ID) error {
	return s.Deals.UnlinkDealCompany(ctx, dealID, companyID)
}
func (s CRMService) ListCompaniesForDeal(ctx context.Context, dealID domain.ID, limit int) ([]domain.Company, error) {
	return s.Deals.ListCompaniesForDeal(ctx, dealID, saneLimit(limit))
}
func (s CRMService) ListDealsForCompany(ctx context.Context, companyID domain.ID, limit int) ([]domain.Deal, error) {
	return s.Deals.ListDealsForCompany(ctx, companyID, saneLimit(limit))
}
func (s CRMService) GetActivity(ctx context.Context, id domain.ID) (domain.Activity, error) {
	return s.Activities.GetActivity(ctx, id)
}
func (s CRMService) CreateActivity(ctx context.Context, a domain.Activity, links []domain.ActivityLink) (domain.Activity, error) {
	if a.Type == "" {
		a.Type = domain.ActivityNote
	}
	if !validActivityType(a.Type) {
		return a, fmt.Errorf("%w: invalid activity type", ErrValidation)
	}
	for _, link := range links {
		if !validLinkedEntityType(link.EntityType) || link.EntityID == "" {
			return a, fmt.Errorf("%w: invalid activity link", ErrValidation)
		}
	}
	return s.Activities.CreateActivity(ctx, a, links)
}
func (s CRMService) UpdateActivity(ctx context.Context, a domain.Activity) (domain.Activity, error) {
	if a.Type == "" {
		a.Type = domain.ActivityNote
	}
	return s.Activities.UpdateActivity(ctx, a)
}
func (s CRMService) UpdateNote(ctx context.Context, a domain.Activity) (domain.Activity, error) {
	existing, err := s.Activities.GetActivity(ctx, a.ID)
	if err != nil {
		return a, err
	}
	if existing.Type != domain.ActivityNote {
		return a, fmt.Errorf("activity %s is %s, not note", a.ID, existing.Type)
	}
	a.Type = domain.ActivityNote
	return s.Activities.UpdateActivity(ctx, a)
}
func (s CRMService) DeleteActivity(ctx context.Context, id domain.ID) error {
	return s.Activities.DeleteActivity(ctx, id)
}
func (s CRMService) LinkActivity(ctx context.Context, activityID domain.ID, entityType domain.EntityType, entityID domain.ID) error {
	if activityID == "" || !validLinkedEntityType(entityType) || entityID == "" {
		return fmt.Errorf("%w: invalid activity link", ErrValidation)
	}
	return s.Activities.LinkActivity(ctx, activityID, entityType, entityID)
}
func (s CRMService) DeleteNote(ctx context.Context, id domain.ID) error {
	a, err := s.Activities.GetActivity(ctx, id)
	if err != nil {
		return err
	}
	if a.Type != domain.ActivityNote {
		return fmt.Errorf("activity %s is %s, not note", id, a.Type)
	}
	return s.Activities.DeleteActivity(ctx, id)
}
func (s CRMService) Timeline(ctx context.Context, entityType domain.EntityType, entityID domain.ID, limit int) ([]domain.TimelineItem, error) {
	return s.Activities.ListTimeline(ctx, entityType, entityID, saneLimit(limit))
}
func (s CRMService) CreateTag(ctx context.Context, tag domain.Tag) (domain.Tag, error) {
	tag.Name = strings.TrimSpace(tag.Name)
	return s.Tags.CreateTag(ctx, tag)
}
func (s CRMService) ListTags(ctx context.Context, limit int) ([]domain.Tag, error) {
	return s.Tags.ListTags(ctx, saneLimit(limit))
}
func (s CRMService) TagEntity(ctx context.Context, tagID domain.ID, entityType domain.EntityType, entityID domain.ID) error {
	return s.Tags.TagEntity(ctx, tagID, entityType, entityID)
}
func (s CRMService) CreateWorkspace(ctx context.Context, workspace domain.Workspace) (domain.Workspace, error) {
	workspace.Name = strings.TrimSpace(workspace.Name)
	if workspace.Name == "" {
		return workspace, fmt.Errorf("%w: workspace name is required", ErrValidation)
	}
	return s.Workspaces.CreateWorkspace(ctx, workspace)
}
func (s CRMService) ListWorkspaces(ctx context.Context, limit int) ([]domain.Workspace, error) {
	return s.Workspaces.ListWorkspaces(ctx, saneLimit(limit))
}
func (s CRMService) LinkWorkspaceEntity(ctx context.Context, workspaceID domain.ID, entityType domain.EntityType, entityID domain.ID) error {
	return s.Workspaces.LinkWorkspaceEntity(ctx, workspaceID, entityType, entityID)
}
func (s CRMService) ListWorkspaceEntities(ctx context.Context, workspaceID domain.ID, entityType domain.EntityType, limit int) ([]domain.WorkspaceEntity, error) {
	return s.Workspaces.ListWorkspaceEntities(ctx, workspaceID, entityType, saneLimit(limit))
}
func (s CRMService) Search(ctx context.Context, query string, limit int) ([]domain.SearchResult, error) {
	return s.SearchStore.Search(ctx, strings.TrimSpace(query), saneLimit(limit))
}
func (s CRMService) CreateTodo(ctx context.Context, t domain.Todo) (domain.Todo, error) {
	t.Title = strings.TrimSpace(t.Title)
	if t.Title == "" {
		return t, fmt.Errorf("%w: task title is required", ErrValidation)
	}
	if t.Status == "" {
		t.Status = domain.TodoOpen
	}
	if !validTodoStatus(t.Status) {
		return t, fmt.Errorf("%w: invalid task status", ErrValidation)
	}
	if t.Priority == "" {
		t.Priority = domain.TodoPriorityNormal
	}
	if !validTodoPriority(t.Priority) {
		return t, fmt.Errorf("%w: invalid task priority", ErrValidation)
	}
	if t.EntityType != "" && !validEntityType(t.EntityType) {
		return t, fmt.Errorf("%w: invalid task entity type", ErrValidation)
	}
	return s.Todos.CreateTodo(ctx, t)
}
func (s CRMService) GetTodo(ctx context.Context, id domain.ID) (domain.Todo, error) {
	return s.Todos.GetTodo(ctx, id)
}
func (s CRMService) UpdateTodo(ctx context.Context, t domain.Todo) (domain.Todo, error) {
	existing, err := s.Todos.GetTodo(ctx, t.ID)
	if err != nil {
		return t, err
	}
	if t.WorkspaceID == "" {
		t.WorkspaceID = existing.WorkspaceID
	}
	if t.Title == "" {
		t.Title = existing.Title
	}
	if t.Body == "" {
		t.Body = existing.Body
	}
	if t.DueAt == nil {
		t.DueAt = existing.DueAt
	}
	if t.Status == "" {
		t.Status = existing.Status
	}
	if t.Priority == "" {
		t.Priority = existing.Priority
	}
	if !validTodoPriority(t.Priority) {
		return t, fmt.Errorf("%w: invalid task priority", ErrValidation)
	}
	if !validTodoStatus(t.Status) {
		return t, fmt.Errorf("%w: invalid task status", ErrValidation)
	}
	return s.Todos.UpdateTodo(ctx, t)
}
func (s CRMService) CompleteTodo(ctx context.Context, id domain.ID) (domain.Todo, error) {
	return s.Todos.CompleteTodo(ctx, id)
}
func (s CRMService) DeleteTodo(ctx context.Context, id domain.ID) error {
	return s.Todos.DeleteTodo(ctx, id)
}
func (s CRMService) ListTodos(ctx context.Context, query, status, due string, entityType domain.EntityType, entityID domain.ID, workspaceID domain.ID, limit, offset int) ([]domain.Todo, error) {
	return s.Todos.ListTodos(ctx, strings.TrimSpace(query), strings.TrimSpace(status), strings.TrimSpace(due), entityType, entityID, workspaceID, saneLimit(limit), saneOffset(offset))
}
func (s CRMService) ListNotes(ctx context.Context, limit int) ([]domain.TimelineItem, error) {
	return s.Activities.ListNotes(ctx, saneLimit(limit))
}
func (s CRMService) Dashboard(ctx context.Context, limit int) ([]domain.Todo, error) {
	return s.Todos.ListActionItems(ctx, saneLimit(limit))
}
func saneLimit(limit int) int {
	if limit <= 0 {
		return 50
	}
	if limit > 100 {
		return 100
	}
	return limit
}
func saneOffset(offset int) int {
	if offset < 0 {
		return 0
	}
	return offset
}

func validActivityType(t domain.ActivityType) bool {
	switch t {
	case domain.ActivityNote, domain.ActivityCall, domain.ActivityMeeting, domain.ActivityEmail:
		return true
	default:
		return false
	}
}

func validEntityType(t domain.EntityType) bool {
	switch t {
	case domain.EntityPerson, domain.EntityCompany, domain.EntityDeal, domain.EntityTodo, domain.EntityActivity:
		return true
	default:
		return false
	}
}

func validLinkedEntityType(t domain.EntityType) bool {
	switch t {
	case domain.EntityPerson, domain.EntityCompany, domain.EntityDeal:
		return true
	default:
		return false
	}
}

func validTodoStatus(s domain.TodoStatus) bool {
	switch s {
	case domain.TodoOpen, domain.TodoDone:
		return true
	default:
		return false
	}
}

func validTodoPriority(p domain.TodoPriority) bool {
	switch p {
	case domain.TodoPriorityLow, domain.TodoPriorityNormal, domain.TodoPriorityHigh, domain.TodoPriorityUrgent:
		return true
	default:
		return false
	}
}

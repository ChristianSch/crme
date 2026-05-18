package httpapi

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"crme/internal/domain"
	"crme/internal/usecase"
)

type routeAuthStoreFake struct {
	revoked domain.ID
	role    string
}

func (s *routeAuthStoreFake) HasUsers(ctx context.Context) (bool, error) { return true, nil }
func (s *routeAuthStoreFake) CreateUser(ctx context.Context, email, role string, active bool) (domain.ID, error) {
	return "user-1", nil
}
func (s *routeAuthStoreFake) ActiveUserByEmail(ctx context.Context, email string) (domain.ID, bool, error) {
	return "user-1", true, nil
}
func (s *routeAuthStoreFake) CreateMagicLink(ctx context.Context, email, tokenHash string, expiresAt time.Time) error {
	return nil
}
func (s *routeAuthStoreFake) ConsumeMagicLink(ctx context.Context, tokenHash string, now time.Time) (string, error) {
	return "user@example.com", nil
}
func (s *routeAuthStoreFake) CreateSession(ctx context.Context, userID domain.ID, email, tokenHash string, expiresAt time.Time) error {
	return nil
}
func (s *routeAuthStoreFake) ValidateSession(ctx context.Context, tokenHash string, now time.Time) (string, error) {
	return "user@example.com", nil
}
func (s *routeAuthStoreFake) RevokeSession(ctx context.Context, tokenHash string, now time.Time) error {
	s.revoked = domain.ID(tokenHash)
	return nil
}
func (s *routeAuthStoreFake) UserBySession(ctx context.Context, tokenHash string, now time.Time) (domain.User, error) {
	return domain.User{ID: "user-1", Email: "user@example.com"}, nil
}
func (s *routeAuthStoreFake) ListOrganizationsForUser(ctx context.Context, userID domain.ID) ([]domain.OrganizationMembership, error) {
	role := s.role
	if role == "" {
		role = "owner"
	}
	return []domain.OrganizationMembership{{OrganizationID: "org-1", UserID: userID, Role: role, Name: "Test Org"}}, nil
}
func (s *routeAuthStoreFake) CreateOrganizationWithOwner(ctx context.Context, name string, ownerUserID domain.ID) (domain.Organization, error) {
	return domain.Organization{ID: "org-1", Name: name}, nil
}
func (s *routeAuthStoreFake) ListOrganizationMembers(ctx context.Context, organizationID domain.ID) ([]domain.OrganizationMember, error) {
	return nil, nil
}
func (s *routeAuthStoreFake) UpdateOrganizationMemberRole(ctx context.Context, organizationID, userID domain.ID, role string) (domain.OrganizationMember, error) {
	return domain.OrganizationMember{OrganizationID: organizationID, UserID: userID, Role: role}, nil
}
func (s *routeAuthStoreFake) RemoveOrganizationMember(ctx context.Context, organizationID, userID domain.ID) error {
	return nil
}
func (s *routeAuthStoreFake) CreateOrganizationInvitation(ctx context.Context, organizationID domain.ID, email, role, tokenHash string, expiresAt time.Time, invitedByUserID domain.ID) (domain.OrganizationInvitation, error) {
	return domain.OrganizationInvitation{ID: "invite-1", OrganizationID: organizationID, OrganizationName: "Test Org", Email: email, Role: role, ExpiresAt: expiresAt}, nil
}
func (s *routeAuthStoreFake) ListOrganizationInvitations(ctx context.Context, organizationID domain.ID) ([]domain.OrganizationInvitation, error) {
	return nil, nil
}
func (s *routeAuthStoreFake) GetOrganizationInvitation(ctx context.Context, tokenHash string, now time.Time) (domain.OrganizationInvitation, error) {
	return domain.OrganizationInvitation{ID: "invite-1", OrganizationID: "org-1", OrganizationName: "Test Org", Email: "user@example.com", Role: "member", ExpiresAt: now.Add(time.Hour)}, nil
}
func (s *routeAuthStoreFake) UpdateOrganizationInvitationToken(ctx context.Context, organizationID, invitationID domain.ID, tokenHash string, expiresAt time.Time) (domain.OrganizationInvitation, error) {
	return domain.OrganizationInvitation{ID: invitationID, OrganizationID: organizationID, OrganizationName: "Test Org", Email: "user@example.com", Role: "member", ExpiresAt: expiresAt}, nil
}
func (s *routeAuthStoreFake) AcceptOrganizationInvitation(ctx context.Context, tokenHash string, now time.Time, userID domain.ID) (domain.OrganizationInvitation, error) {
	return domain.OrganizationInvitation{ID: "invite-1", OrganizationID: "org-1", OrganizationName: "Test Org", Email: "user@example.com", Role: "member", ExpiresAt: now.Add(time.Hour), AcceptedAt: &now}, nil
}

type routePersonStoreFake struct {
	person  domain.Person
	updated domain.Person
}

func (s *routePersonStoreFake) CreatePerson(ctx context.Context, p domain.Person) (domain.Person, error) {
	p.ID = "person-1"
	return p, nil
}
func (s *routePersonStoreFake) GetPerson(ctx context.Context, id domain.ID) (domain.Person, error) {
	p := s.person
	p.ID = id
	return p, nil
}
func (s *routePersonStoreFake) UpdatePerson(ctx context.Context, p domain.Person) (domain.Person, error) {
	s.updated = p
	return p, nil
}
func (s *routePersonStoreFake) DeletePerson(ctx context.Context, id domain.ID) error { return nil }
func (s *routePersonStoreFake) ListPeople(ctx context.Context, query string, workspaceID domain.ID, limit, offset int) ([]domain.Person, error) {
	return nil, nil
}
func (s *routePersonStoreFake) FindPersonByEmail(ctx context.Context, email string) (domain.Person, bool, error) {
	return domain.Person{}, false, nil
}
func (s *routePersonStoreFake) AddPersonEmail(ctx context.Context, personID domain.ID, email string, primary bool) error {
	return nil
}
func (s *routePersonStoreFake) TouchPerson(ctx context.Context, id domain.ID, at time.Time) error {
	return nil
}

func routeAPI(auth *routeAuthStoreFake, people *routePersonStoreFake) API {
	return API{
		Auth:           usecase.AuthService{Store: auth, Organizations: auth, Secret: "secret"},
		AllowedOrigins: []string{"http://localhost"},
		CRM:            usecase.CRMService{People: people},
	}
}

func authedJSONRequest(method, path, body string) *http.Request {
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost")
	req.AddCookie(&http.Cookie{Name: "crm_session", Value: "session-1"})
	return req
}

func TestLogoutRouteRevokesSessionAndClearsCookie(t *testing.T) {
	auth := &routeAuthStoreFake{}
	api := routeAPI(auth, &routePersonStoreFake{})
	res := httptest.NewRecorder()

	api.Handler().ServeHTTP(res, authedJSONRequest(http.MethodPost, "/auth/logout", "{}"))

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}
	if auth.revoked == "" || auth.revoked == "session-1" {
		t.Fatalf("expected hashed session token revoked, got %q", auth.revoked)
	}
	if setCookie := res.Header().Values("Set-Cookie"); len(setCookie) == 0 || !strings.Contains(strings.Join(setCookie, ";"), "crm_session=") || !strings.Contains(strings.Join(setCookie, ";"), "Max-Age=0") {
		t.Fatalf("expected clearing session cookie, got %v", setCookie)
	}
}

func TestUpdatePersonRoutePreservesOmittedAndClearsExplicitEmpty(t *testing.T) {
	people := &routePersonStoreFake{person: domain.Person{FirstName: "Ada", LastName: "Lovelace", Title: "Engineer", Email: "ada@example.com"}}
	api := routeAPI(&routeAuthStoreFake{}, people)
	res := httptest.NewRecorder()

	api.Handler().ServeHTTP(res, authedJSONRequest(http.MethodPatch, "/people/person-1", `{"title":""}`))

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}
	if people.updated.FirstName != "Ada" || people.updated.LastName != "Lovelace" || people.updated.Email != "ada@example.com" {
		t.Fatalf("expected omitted fields preserved, got %+v", people.updated)
	}
	if people.updated.Title != "" {
		t.Fatalf("expected title cleared, got %q", people.updated.Title)
	}
}

func TestCreatePersonRouteRequiresName(t *testing.T) {
	api := routeAPI(&routeAuthStoreFake{}, &routePersonStoreFake{})
	res := httptest.NewRecorder()

	api.Handler().ServeHTTP(res, authedJSONRequest(http.MethodPost, "/people", `{"email":"nameless@example.com"}`))

	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", res.Code, res.Body.String())
	}
}

func TestViewerCannotMutateCRM(t *testing.T) {
	api := routeAPI(&routeAuthStoreFake{role: "viewer"}, &routePersonStoreFake{})
	res := httptest.NewRecorder()

	api.Handler().ServeHTTP(res, authedJSONRequest(http.MethodPost, "/people", `{"first_name":"Ada"}`))

	if res.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", res.Code, res.Body.String())
	}
}

func TestViewerCannotMutateProtectedRoutes(t *testing.T) {
	routes := []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodPost, "/people", `{"first_name":"Ada"}`},
		{http.MethodPost, "/ai/actions/execute", `{"command":"task-create","args":["title=Follow up"]}`},
		{http.MethodPost, "/email/accounts", `{"name":"Work","email":"viewer@example.com"}`},
		{http.MethodPost, "/email/accounts/test", `{"name":"Work","email":"viewer@example.com"}`},
		{http.MethodPost, "/email/sync", `{}`},
	}

	for _, route := range routes {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			api := routeAPI(&routeAuthStoreFake{role: "viewer"}, &routePersonStoreFake{})
			res := httptest.NewRecorder()

			api.Handler().ServeHTTP(res, authedJSONRequest(route.method, route.path, route.body))

			if res.Code != http.StatusForbidden {
				t.Fatalf("expected 403, got %d: %s", res.Code, res.Body.String())
			}
		})
	}
}

func TestMemberCannotManageOrganizationMembers(t *testing.T) {
	api := routeAPI(&routeAuthStoreFake{role: "member"}, &routePersonStoreFake{})
	res := httptest.NewRecorder()

	api.Handler().ServeHTTP(res, authedJSONRequest(http.MethodGet, "/organizations/org-1/members", ""))

	if res.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", res.Code, res.Body.String())
	}
}

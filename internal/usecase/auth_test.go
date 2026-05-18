package usecase

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"crme/internal/authctx"
	"crme/internal/domain"
)

type authStoreFake struct {
	users            map[string]domain.ID
	links            int
	sessions         int
	nextUserID       domain.ID
	consumedEmail    string
	sessionTokenHash string
}

func newAuthStoreFake() *authStoreFake {
	return &authStoreFake{users: map[string]domain.ID{}, nextUserID: "user-1"}
}

func requireAuthenticator(ctx context.Context) error {
	access, ok := authctx.AccessFrom(ctx)
	if !ok || !authctx.IsAuthenticator(access) {
		return errors.New("missing authenticator context")
	}
	return nil
}

func (f *authStoreFake) HasUsers(ctx context.Context) (bool, error) {
	if err := requireAuthenticator(ctx); err != nil {
		return false, err
	}
	return len(f.users) > 0, nil
}
func (f *authStoreFake) CreateUser(ctx context.Context, email, role string, active bool) (domain.ID, error) {
	if err := requireAuthenticator(ctx); err != nil {
		return "", err
	}
	f.users[email] = f.nextUserID
	return f.nextUserID, nil
}
func (f *authStoreFake) ActiveUserByEmail(ctx context.Context, email string) (domain.ID, bool, error) {
	if err := requireAuthenticator(ctx); err != nil {
		return "", false, err
	}
	id, ok := f.users[email]
	return id, ok, nil
}
func (f *authStoreFake) CreateMagicLink(ctx context.Context, email, tokenHash string, expiresAt time.Time) error {
	if err := requireAuthenticator(ctx); err != nil {
		return err
	}
	f.links++
	return nil
}
func (f *authStoreFake) ConsumeMagicLink(ctx context.Context, tokenHash string, now time.Time) (string, error) {
	if err := requireAuthenticator(ctx); err != nil {
		return "", err
	}
	return f.consumedEmail, nil
}
func (f *authStoreFake) CreateSession(ctx context.Context, userID domain.ID, email, tokenHash string, expiresAt time.Time) error {
	if err := requireAuthenticator(ctx); err != nil {
		return err
	}
	f.sessions++
	f.sessionTokenHash = tokenHash
	return nil
}
func (f *authStoreFake) ValidateSession(ctx context.Context, tokenHash string, now time.Time) (string, error) {
	if err := requireAuthenticator(ctx); err != nil {
		return "", err
	}
	return "", nil
}
func (f *authStoreFake) RevokeSession(ctx context.Context, tokenHash string, now time.Time) error {
	if err := requireAuthenticator(ctx); err != nil {
		return err
	}
	return nil
}

type authOrgStoreFake struct {
	user           domain.User
	inviteEmail    string
	memberships    []domain.OrganizationMembership
	members        []domain.OrganizationMember
	createdOrgName string
}

func (f *authOrgStoreFake) UserBySession(ctx context.Context, tokenHash string, now time.Time) (domain.User, error) {
	return f.user, nil
}
func (f *authOrgStoreFake) ListOrganizationsForUser(ctx context.Context, userID domain.ID) ([]domain.OrganizationMembership, error) {
	return f.memberships, nil
}
func (f *authOrgStoreFake) CreateOrganizationWithOwner(ctx context.Context, name string, ownerUserID domain.ID) (domain.Organization, error) {
	f.createdOrgName = name
	return domain.Organization{ID: "org-1", Name: name}, nil
}
func (f *authOrgStoreFake) ListOrganizationMembers(ctx context.Context, organizationID domain.ID) ([]domain.OrganizationMember, error) {
	return f.members, nil
}
func (f *authOrgStoreFake) UpdateOrganizationMemberRole(ctx context.Context, organizationID, userID domain.ID, role string) (domain.OrganizationMember, error) {
	return domain.OrganizationMember{OrganizationID: organizationID, UserID: userID, Role: role}, nil
}
func (f *authOrgStoreFake) RemoveOrganizationMember(ctx context.Context, organizationID, userID domain.ID) error {
	return nil
}
func (f *authOrgStoreFake) CreateOrganizationInvitation(ctx context.Context, organizationID domain.ID, email, role, tokenHash string, expiresAt time.Time, invitedByUserID domain.ID) (domain.OrganizationInvitation, error) {
	return domain.OrganizationInvitation{ID: "invite-1", OrganizationID: organizationID, OrganizationName: "Acme", Email: email, Role: role, ExpiresAt: expiresAt}, nil
}
func (f *authOrgStoreFake) ListOrganizationInvitations(ctx context.Context, organizationID domain.ID) ([]domain.OrganizationInvitation, error) {
	return nil, nil
}
func (f *authOrgStoreFake) GetOrganizationInvitation(ctx context.Context, tokenHash string, now time.Time) (domain.OrganizationInvitation, error) {
	email := f.inviteEmail
	if email == "" {
		email = f.user.Email
	}
	return domain.OrganizationInvitation{ID: "invite-1", OrganizationID: "org-1", OrganizationName: "Acme", Email: email, Role: "member", ExpiresAt: now.Add(time.Hour)}, nil
}
func (f *authOrgStoreFake) UpdateOrganizationInvitationToken(ctx context.Context, organizationID, invitationID domain.ID, tokenHash string, expiresAt time.Time) (domain.OrganizationInvitation, error) {
	return domain.OrganizationInvitation{ID: invitationID, OrganizationID: organizationID, OrganizationName: "Acme", Email: f.user.Email, Role: "member", ExpiresAt: expiresAt}, nil
}
func (f *authOrgStoreFake) AcceptOrganizationInvitation(ctx context.Context, tokenHash string, now time.Time, userID domain.ID) (domain.OrganizationInvitation, error) {
	return domain.OrganizationInvitation{ID: "invite-1", OrganizationID: "org-1", OrganizationName: "Acme", Email: f.user.Email, Role: "member", ExpiresAt: now.Add(time.Hour), AcceptedAt: &now}, nil
}

type senderFake struct{ sent int }

func (s *senderFake) SendMagicLink(ctx context.Context, email, url string) error {
	s.sent++
	return nil
}

func TestRequestMagicLinkUnknownEmailDoesNotSend(t *testing.T) {
	store := newAuthStoreFake()
	store.users["owner@example.com"] = "user-1"
	sender := &senderFake{}
	svc := AuthService{Store: store, Sender: sender, BaseURL: "http://localhost", Secret: "secret", BootstrapOwnerEmail: "owner@example.com"}

	if err := svc.RequestMagicLink(context.Background(), "stranger@example.com", false); err != nil {
		t.Fatal(err)
	}
	if store.links != 0 || sender.sent != 0 {
		t.Fatalf("expected no link sent, got links=%d sent=%d", store.links, sender.sent)
	}
}

func TestRequestMagicLinkBootstrapsFirstOwner(t *testing.T) {
	store := newAuthStoreFake()
	sender := &senderFake{}
	svc := AuthService{Store: store, Sender: sender, BaseURL: "http://localhost", Secret: "secret", BootstrapOwnerEmail: "owner@example.com"}

	if err := svc.RequestMagicLink(context.Background(), "owner@example.com", false); err != nil {
		t.Fatal(err)
	}
	if _, ok := store.users["owner@example.com"]; !ok {
		t.Fatal("expected owner user to be created")
	}
	if store.links != 1 || sender.sent != 1 {
		t.Fatalf("expected one link sent, got links=%d sent=%d", store.links, sender.sent)
	}
}

func TestRequestMagicLinkSignupDisabledDoesNotCreatePublicUser(t *testing.T) {
	store := newAuthStoreFake()
	store.users["owner@example.com"] = "user-1"
	sender := &senderFake{}
	svc := AuthService{Store: store, Sender: sender, BaseURL: "http://localhost", Secret: "secret"}

	if err := svc.RequestMagicLink(context.Background(), "new@example.com", true); err != nil {
		t.Fatal(err)
	}
	if _, ok := store.users["new@example.com"]; ok {
		t.Fatal("expected signup user not to be created")
	}
	if store.links != 0 || sender.sent != 0 {
		t.Fatalf("expected no link sent, got links=%d sent=%d", store.links, sender.sent)
	}
}

func TestRequestMagicLinkSignupCreatesPublicUserWhenAllowed(t *testing.T) {
	store := newAuthStoreFake()
	store.users["owner@example.com"] = "user-1"
	sender := &senderFake{}
	svc := AuthService{Store: store, Sender: sender, BaseURL: "http://localhost", Secret: "secret", AllowSignup: true}

	if err := svc.RequestMagicLink(context.Background(), "new@example.com", true); err != nil {
		t.Fatal(err)
	}
	if _, ok := store.users["new@example.com"]; !ok {
		t.Fatal("expected signup user to be created")
	}
	if store.links != 1 || sender.sent != 1 {
		t.Fatalf("expected one link sent, got links=%d sent=%d", store.links, sender.sent)
	}
}

func TestVerifyMagicLinkStoresHashAndReturnsRawSessionToken(t *testing.T) {
	store := newAuthStoreFake()
	store.users["owner@example.com"] = "user-1"
	store.consumedEmail = "owner@example.com"
	svc := AuthService{Store: store, Sender: &senderFake{}, BaseURL: "http://localhost", Secret: "secret"}

	sessionToken, err := svc.VerifyMagicLink(context.Background(), "magic-token")
	if err != nil {
		t.Fatal(err)
	}
	if sessionToken == "" {
		t.Fatal("expected raw session token")
	}
	if store.sessionTokenHash == "" || store.sessionTokenHash == string(sessionToken) {
		t.Fatalf("expected stored session token hash, got token=%q hash=%q", sessionToken, store.sessionTokenHash)
	}
}

func TestMeReturnsOrganizationsAndCapabilities(t *testing.T) {
	orgs := &authOrgStoreFake{
		user:        domain.User{ID: "user-1", Email: "owner@example.com"},
		memberships: []domain.OrganizationMembership{{OrganizationID: "org-1", Role: "owner", Name: "Acme"}},
	}
	svc := AuthService{Organizations: orgs, Secret: "secret"}

	me, err := svc.Me(context.Background(), "session-token", "")
	if err != nil {
		t.Fatal(err)
	}
	if me.CurrentOrganizationID != "org-1" || !me.Capabilities.Admin || !me.Capabilities.CanInviteMembers {
		t.Fatalf("unexpected me response: %+v", me)
	}
}

func TestCreateOrganizationCreatesOwnerMembership(t *testing.T) {
	orgs := &authOrgStoreFake{user: domain.User{ID: "user-1", Email: "owner@example.com"}}
	svc := AuthService{Organizations: orgs, Secret: "secret"}

	org, err := svc.CreateOrganization(context.Background(), "session-token", " Acme ")
	if err != nil {
		t.Fatal(err)
	}
	if org.Name != "Acme" || orgs.createdOrgName != "Acme" {
		t.Fatalf("expected trimmed org name, got org=%+v created=%q", org, orgs.createdOrgName)
	}
}

func TestUpdateOrganizationMemberRoleRejectsLastOwnerDemotion(t *testing.T) {
	orgs := &authOrgStoreFake{members: []domain.OrganizationMember{{OrganizationID: "org-1", UserID: "user-1", Role: "owner"}}}
	svc := AuthService{Organizations: orgs, Secret: "secret"}

	_, err := svc.UpdateOrganizationMemberRole(context.Background(), "owner", "org-1", "user-1", "member")
	if err == nil || !strings.Contains(err.Error(), "last owner") {
		t.Fatalf("expected last owner validation error, got %v", err)
	}
}

func TestAcceptOrganizationInvitationRejectsEmailMismatch(t *testing.T) {
	orgs := &authOrgStoreFake{user: domain.User{ID: "user-1", Email: "ada@example.com"}, inviteEmail: "grace@example.com"}
	svc := AuthService{Organizations: orgs, Secret: "secret"}

	_, err := svc.AcceptOrganizationInvitation(context.Background(), "session-token", "invite-token")
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden mismatch, got %v", err)
	}
}

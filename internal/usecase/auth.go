package usecase

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/url"
	"strings"
	"time"

	"crme/internal/authctx"
	"crme/internal/domain"
	"crme/internal/ports"
)

type AuthService struct {
	Store               ports.AuthStore
	Organizations       ports.OrganizationStore
	Audit               ports.AuditLogStore
	Sender              ports.MagicLinkSender
	BaseURL             string
	InvitationBaseURL   string
	Secret              string
	BootstrapOwnerEmail string
	AllowSignup         bool
	Now                 func() time.Time
}

func (s AuthService) RequestMagicLink(ctx context.Context, email string, signup bool) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || !strings.Contains(email, "@") {
		return fmt.Errorf("%w: valid email is required", ErrValidation)
	}
	allowed, err := s.ensureCanLogin(ctx, email, signup)
	if err != nil {
		return err
	}
	// Do not reveal whether an address is allowed to log in.
	if !allowed {
		slog.InfoContext(ctx, "magic link skipped for unauthorized email")
		return nil
	}
	token, err := randomToken()
	if err != nil {
		return err
	}
	expiresAt := s.now().Add(15 * time.Minute)
	authCtx := authctx.WithAuthAccess(ctx)
	if err := s.Store.CreateMagicLink(authCtx, email, s.hash(token), expiresAt); err != nil {
		return err
	}
	link := strings.TrimRight(s.BaseURL, "/") + "/auth/verify?token=" + url.QueryEscape(token)
	if err := s.Sender.SendMagicLink(ctx, email, link); err != nil {
		return err
	}
	slog.InfoContext(ctx, "magic link sent", "email", email)
	return nil
}

func (s AuthService) VerifyMagicLink(ctx context.Context, token string) (domain.ID, error) {
	authCtx := authctx.WithAuthAccess(ctx)
	email, err := s.Store.ConsumeMagicLink(authCtx, s.hash(token), s.now())
	if err != nil {
		return "", ErrUnauthorized
	}
	userID, ok, err := s.Store.ActiveUserByEmail(authCtx, email)
	if err != nil {
		return "", err
	}
	if !ok {
		return "", ErrUnauthorized
	}
	sessionToken, err := randomToken()
	if err != nil {
		return "", err
	}
	if err := s.Store.CreateSession(authCtx, userID, email, s.hash(sessionToken), s.now().Add(30*24*time.Hour)); err != nil {
		return "", err
	}
	slog.InfoContext(ctx, "session created", "email", email)
	return domain.ID(sessionToken), nil
}

func (s AuthService) ValidateSession(ctx context.Context, sessionID domain.ID) (string, error) {
	if sessionID == "" {
		return "", ErrUnauthorized
	}
	return s.Store.ValidateSession(authctx.WithAuthAccess(ctx), s.hash(string(sessionID)), s.now())
}

func (s AuthService) SessionUser(ctx context.Context, sessionID domain.ID) (domain.User, error) {
	if s.Organizations == nil || sessionID == "" {
		return domain.User{}, ErrUnauthorized
	}
	user, err := s.Organizations.UserBySession(authctx.WithAuthAccess(ctx), s.hash(string(sessionID)), s.now())
	if err != nil {
		return domain.User{}, ErrUnauthorized
	}
	return user, nil
}

func (s AuthService) Logout(ctx context.Context, sessionID domain.ID) error {
	if sessionID == "" {
		return ErrUnauthorized
	}
	if err := s.Store.RevokeSession(authctx.WithAuthAccess(ctx), s.hash(string(sessionID)), s.now()); err != nil {
		return err
	}
	slog.InfoContext(ctx, "session revoked")
	return nil
}

func (s AuthService) Me(ctx context.Context, sessionID, organizationID domain.ID) (domain.Me, error) {
	user, memberships, currentOrgID, role, err := s.currentAccess(ctx, sessionID, organizationID)
	if err != nil {
		return domain.Me{}, err
	}
	return domain.Me{User: user, Organizations: memberships, CurrentOrganizationID: currentOrgID, Capabilities: capabilitiesFor(role)}, nil
}

func (s AuthService) Capabilities(ctx context.Context, sessionID, organizationID domain.ID) (domain.Capabilities, error) {
	_, _, _, role, err := s.currentAccess(ctx, sessionID, organizationID)
	if err != nil {
		return domain.Capabilities{}, err
	}
	return capabilitiesFor(role), nil
}

func (s AuthService) MeFromAccess(ctx context.Context, user domain.User, organizationID domain.ID, role string) (domain.Me, error) {
	memberships, err := s.Organizations.ListOrganizationsForUser(ctx, user.ID)
	if err != nil {
		return domain.Me{}, err
	}
	return domain.Me{User: user, Organizations: memberships, CurrentOrganizationID: organizationID, Capabilities: capabilitiesFor(role)}, nil
}

func (s AuthService) CapabilitiesForRole(role string) domain.Capabilities {
	return capabilitiesFor(role)
}

func (s AuthService) Access(ctx context.Context, sessionID, organizationID domain.ID) (domain.User, domain.ID, string, error) {
	user, _, currentOrgID, role, err := s.currentAccess(ctx, sessionID, organizationID)
	if err != nil {
		return domain.User{}, "", "", err
	}
	if currentOrgID == "" {
		return domain.User{}, "", "", fmt.Errorf("%w: organization_id is required", ErrValidation)
	}
	return user, currentOrgID, role, nil
}

func (s AuthService) AccessAPIToken(ctx context.Context, token string) (domain.User, domain.ID, string, error) {
	if token == "" || !strings.HasPrefix(token, "crme_pat_") {
		return domain.User{}, "", "", ErrUnauthorized
	}
	user, orgID, role, err := s.Store.UserByAPIToken(authctx.WithAuthAccess(ctx), s.hash(token), s.now())
	if err != nil {
		return domain.User{}, "", "", ErrUnauthorized
	}
	return user, orgID, role, nil
}

func (s AuthService) ListAPITokens(ctx context.Context, userID, organizationID domain.ID) ([]domain.APIToken, error) {
	if organizationID == "" || userID == "" {
		return nil, ErrUnauthorized
	}
	return s.Store.ListAPITokens(ctx, userID, organizationID)
}

func (s AuthService) CreateAPIToken(ctx context.Context, userID, organizationID domain.ID, name string) (domain.APIToken, error) {
	if organizationID == "" || userID == "" {
		return domain.APIToken{}, ErrUnauthorized
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return domain.APIToken{}, fmt.Errorf("%w: token name is required", ErrValidation)
	}
	raw, err := randomToken()
	if err != nil {
		return domain.APIToken{}, err
	}
	secret := "crme_pat_" + raw
	out, err := s.Store.CreateAPIToken(ctx, domain.APIToken{UserID: userID, OrganizationID: organizationID, Name: name}, s.hash(secret))
	if err != nil {
		return out, err
	}
	out.Token = secret
	s.recordAudit(ctx, domain.AuditLog{OrganizationID: organizationID, Action: "api_token.created", TargetType: "api_token", TargetID: out.ID, Details: map[string]any{"name": name}})
	return out, nil
}

func (s AuthService) RevokeAPIToken(ctx context.Context, userID, organizationID, tokenID domain.ID) error {
	if organizationID == "" || userID == "" || tokenID == "" {
		return ErrUnauthorized
	}
	if err := s.Store.RevokeAPIToken(ctx, userID, organizationID, tokenID, s.now()); err != nil {
		return err
	}
	s.recordAudit(ctx, domain.AuditLog{OrganizationID: organizationID, Action: "api_token.revoked", TargetType: "api_token", TargetID: tokenID})
	return nil
}

func (s AuthService) CreateOrganization(ctx context.Context, sessionID domain.ID, name string) (domain.Organization, error) {
	if s.Organizations == nil {
		return domain.Organization{}, ErrForbidden
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return domain.Organization{}, fmt.Errorf("%w: organization name is required", ErrValidation)
	}
	user, err := s.Organizations.UserBySession(authctx.WithAuthAccess(ctx), s.hash(string(sessionID)), s.now())
	if err != nil {
		return domain.Organization{}, ErrUnauthorized
	}
	orgCtx := authctx.WithAccess(ctx, authctx.Access{UserID: user.ID, Role: "org_creator"})
	return s.Organizations.CreateOrganizationWithOwner(orgCtx, name, user.ID)
}

func (s AuthService) ListOrganizationMembers(ctx context.Context, actorRole string, organizationID domain.ID) ([]domain.OrganizationMember, error) {
	if s.Organizations == nil {
		return nil, ErrForbidden
	}
	if organizationID == "" {
		return nil, fmt.Errorf("%w: organization_id is required", ErrValidation)
	}
	if !canManageMembers(actorRole) {
		return nil, ErrForbidden
	}
	return s.Organizations.ListOrganizationMembers(ctx, organizationID)
}

func (s AuthService) UpdateOrganizationMemberRole(ctx context.Context, actorRole string, organizationID, userID domain.ID, role string) (domain.OrganizationMember, error) {
	if s.Organizations == nil {
		return domain.OrganizationMember{}, ErrForbidden
	}
	if !canManageMembers(actorRole) {
		return domain.OrganizationMember{}, ErrForbidden
	}
	role = strings.TrimSpace(strings.ToLower(role))
	if !validOrganizationRole(role) {
		return domain.OrganizationMember{}, fmt.Errorf("%w: invalid role", ErrValidation)
	}
	if role != "owner" {
		if err := s.ensureNotLastOwner(ctx, organizationID, userID); err != nil {
			return domain.OrganizationMember{}, err
		}
	}
	member, err := s.Organizations.UpdateOrganizationMemberRole(ctx, organizationID, userID, role)
	if err != nil {
		return member, err
	}
	s.recordAudit(ctx, domain.AuditLog{OrganizationID: organizationID, Action: "organization.member_role_updated", TargetType: "organization_member", TargetID: userID, Details: map[string]any{"role": role}})
	return member, nil
}

func (s AuthService) RemoveOrganizationMember(ctx context.Context, actorRole string, organizationID, userID domain.ID) error {
	if s.Organizations == nil {
		return ErrForbidden
	}
	if !canManageMembers(actorRole) {
		return ErrForbidden
	}
	if err := s.ensureNotLastOwner(ctx, organizationID, userID); err != nil {
		return err
	}
	if err := s.Organizations.RemoveOrganizationMember(ctx, organizationID, userID); err != nil {
		return err
	}
	s.recordAudit(ctx, domain.AuditLog{OrganizationID: organizationID, Action: "organization.member_removed", TargetType: "organization_member", TargetID: userID})
	return nil
}

func (s AuthService) InviteOrganizationMember(ctx context.Context, actorRole string, organizationID, invitedByUserID domain.ID, email, role string) (domain.OrganizationInvitation, error) {
	if s.Organizations == nil || s.Sender == nil {
		return domain.OrganizationInvitation{}, ErrForbidden
	}
	if !canManageMembers(actorRole) {
		return domain.OrganizationInvitation{}, ErrForbidden
	}
	email = strings.ToLower(strings.TrimSpace(email))
	role = strings.TrimSpace(strings.ToLower(role))
	if email == "" || !strings.Contains(email, "@") {
		return domain.OrganizationInvitation{}, fmt.Errorf("%w: valid email is required", ErrValidation)
	}
	if role == "owner" || !validOrganizationRole(role) {
		return domain.OrganizationInvitation{}, fmt.Errorf("%w: invalid role", ErrValidation)
	}
	authCtx := authctx.WithAuthAccess(ctx)
	if _, ok, err := s.Store.ActiveUserByEmail(authCtx, email); err != nil {
		return domain.OrganizationInvitation{}, err
	} else if !ok {
		if _, err := s.Store.CreateUser(authCtx, email, "member", true); err != nil {
			return domain.OrganizationInvitation{}, err
		}
	}
	token, err := randomToken()
	if err != nil {
		return domain.OrganizationInvitation{}, err
	}
	invitation, err := s.Organizations.CreateOrganizationInvitation(ctx, organizationID, email, role, s.hash(token), s.now().Add(7*24*time.Hour), invitedByUserID)
	if err != nil {
		return domain.OrganizationInvitation{}, err
	}
	baseURL := strings.TrimRight(s.InvitationBaseURL, "/")
	if baseURL == "" {
		baseURL = strings.TrimRight(s.BaseURL, "/")
	}
	link := baseURL + "/invitations/" + url.PathEscape(token)
	if err := s.Sender.SendMagicLink(ctx, email, link); err != nil {
		return domain.OrganizationInvitation{}, err
	}
	s.recordAudit(ctx, domain.AuditLog{OrganizationID: organizationID, Action: "organization.invitation_created", TargetType: "organization_invitation", TargetID: invitation.ID, Details: map[string]any{"email": email, "role": role}})
	return invitation, nil
}

func (s AuthService) ListOrganizationInvitations(ctx context.Context, actorRole string, organizationID domain.ID) ([]domain.OrganizationInvitation, error) {
	if s.Organizations == nil {
		return nil, ErrForbidden
	}
	if !canManageMembers(actorRole) {
		return nil, ErrForbidden
	}
	return s.Organizations.ListOrganizationInvitations(ctx, organizationID)
}

func (s AuthService) ResendOrganizationInvitation(ctx context.Context, actorRole string, organizationID, invitationID domain.ID) (domain.OrganizationInvitation, error) {
	if s.Organizations == nil || s.Sender == nil {
		return domain.OrganizationInvitation{}, ErrForbidden
	}
	if !canManageMembers(actorRole) {
		return domain.OrganizationInvitation{}, ErrForbidden
	}
	token, err := randomToken()
	if err != nil {
		return domain.OrganizationInvitation{}, err
	}
	invitation, err := s.Organizations.UpdateOrganizationInvitationToken(ctx, organizationID, invitationID, s.hash(token), s.now().Add(7*24*time.Hour))
	if err != nil {
		return domain.OrganizationInvitation{}, err
	}
	if invitation.AcceptedAt != nil {
		return domain.OrganizationInvitation{}, fmt.Errorf("%w: invitation already accepted", ErrValidation)
	}
	baseURL := strings.TrimRight(s.InvitationBaseURL, "/")
	if baseURL == "" {
		baseURL = strings.TrimRight(s.BaseURL, "/")
	}
	link := baseURL + "/invitations/" + url.PathEscape(token)
	if err := s.Sender.SendMagicLink(ctx, invitation.Email, link); err != nil {
		return domain.OrganizationInvitation{}, err
	}
	s.recordAudit(ctx, domain.AuditLog{OrganizationID: organizationID, Action: "organization.invitation_resent", TargetType: "organization_invitation", TargetID: invitation.ID, Details: map[string]any{"email": invitation.Email, "role": invitation.Role}})
	return invitation, nil
}

func (s AuthService) GetOrganizationInvitation(ctx context.Context, token string) (domain.OrganizationInvitation, error) {
	if s.Organizations == nil {
		return domain.OrganizationInvitation{}, ErrForbidden
	}
	return s.Organizations.GetOrganizationInvitation(ctx, s.hash(token), s.now())
}

func (s AuthService) AcceptOrganizationInvitation(ctx context.Context, sessionID domain.ID, token string) (domain.OrganizationInvitation, error) {
	if s.Organizations == nil {
		return domain.OrganizationInvitation{}, ErrForbidden
	}
	user, err := s.Organizations.UserBySession(authctx.WithAuthAccess(ctx), s.hash(string(sessionID)), s.now())
	if err != nil {
		return domain.OrganizationInvitation{}, ErrUnauthorized
	}
	invitation, err := s.Organizations.GetOrganizationInvitation(ctx, s.hash(token), s.now())
	if err != nil {
		return domain.OrganizationInvitation{}, err
	}
	if !strings.EqualFold(invitation.Email, user.Email) {
		return domain.OrganizationInvitation{}, ErrForbidden
	}
	acceptCtx := authctx.WithAccess(ctx, authctx.Access{UserID: user.ID, OrganizationID: invitation.OrganizationID, Role: invitation.Role})
	accepted, err := s.Organizations.AcceptOrganizationInvitation(acceptCtx, s.hash(token), s.now(), user.ID)
	if err != nil {
		return accepted, err
	}
	auditCtx := ctx
	if _, ok := authctx.AccessFrom(ctx); !ok {
		auditCtx = authctx.WithAccess(ctx, authctx.Access{UserID: user.ID, OrganizationID: accepted.OrganizationID, Role: accepted.Role})
	}
	s.recordAudit(auditCtx, domain.AuditLog{OrganizationID: accepted.OrganizationID, ActorUserID: user.ID, Action: "organization.invitation_accepted", TargetType: "organization_invitation", TargetID: accepted.ID, Details: map[string]any{"email": accepted.Email, "role": accepted.Role}})
	return accepted, nil
}

func (s AuthService) ensureNotLastOwner(ctx context.Context, organizationID, userID domain.ID) error {
	members, err := s.Organizations.ListOrganizationMembers(ctx, organizationID)
	if err != nil {
		return err
	}
	ownerCount := 0
	isTargetOwner := false
	for _, member := range members {
		if member.Role != "owner" {
			continue
		}
		ownerCount++
		if member.UserID == userID {
			isTargetOwner = true
		}
	}
	if isTargetOwner && ownerCount <= 1 {
		return fmt.Errorf("%w: cannot remove or demote the last owner", ErrValidation)
	}
	return nil
}

func canManageMembers(role string) bool {
	return role == "owner" || role == "admin"
}

func validOrganizationRole(role string) bool {
	switch role {
	case "owner", "admin", "member", "viewer":
		return true
	default:
		return false
	}
}

func (s AuthService) currentAccess(ctx context.Context, sessionID, organizationID domain.ID) (domain.User, []domain.OrganizationMembership, domain.ID, string, error) {
	if s.Organizations == nil || sessionID == "" {
		return domain.User{}, nil, "", "", ErrUnauthorized
	}
	user, err := s.Organizations.UserBySession(authctx.WithAuthAccess(ctx), s.hash(string(sessionID)), s.now())
	if err != nil {
		return domain.User{}, nil, "", "", ErrUnauthorized
	}
	userCtx := authctx.WithAccess(ctx, authctx.Access{UserID: user.ID})
	memberships, err := s.Organizations.ListOrganizationsForUser(userCtx, user.ID)
	if err != nil {
		return domain.User{}, nil, "", "", err
	}
	if organizationID == "" {
		if len(memberships) == 1 {
			organizationID = memberships[0].OrganizationID
		} else {
			return user, memberships, "", "", nil
		}
	}
	for _, membership := range memberships {
		if membership.OrganizationID == organizationID {
			return user, memberships, organizationID, membership.Role, nil
		}
	}
	return domain.User{}, nil, "", "", ErrForbidden
}

func capabilitiesFor(role string) domain.Capabilities {
	c := domain.Capabilities{Role: role, CanCreateOrganization: true}
	switch role {
	case "owner":
		c.Admin = true
		c.CanManageOrganization = true
		c.CanManageMembers = true
		c.CanInviteMembers = true
		c.CanWriteCRM = true
		c.CanDeleteCRM = true
	case "admin":
		c.Admin = true
		c.CanManageOrganization = true
		c.CanManageMembers = true
		c.CanInviteMembers = true
		c.CanWriteCRM = true
		c.CanDeleteCRM = true
	case "member":
		c.CanWriteCRM = true
	case "viewer":
	}
	return c
}

func (s AuthService) ensureCanLogin(ctx context.Context, email string, signup bool) (bool, error) {
	authCtx := authctx.WithAuthAccess(ctx)
	if _, ok, err := s.Store.ActiveUserByEmail(authCtx, email); err != nil || ok {
		return ok, err
	}
	if signup && s.AllowSignup {
		_, err := s.Store.CreateUser(authCtx, email, "member", true)
		return err == nil, err
	}
	hasUsers, err := s.Store.HasUsers(authCtx)
	if err != nil {
		return false, err
	}
	if hasUsers {
		return false, nil
	}
	bootstrap := strings.ToLower(strings.TrimSpace(s.BootstrapOwnerEmail))
	if bootstrap == "" || bootstrap != email {
		return false, nil
	}
	_, err = s.Store.CreateUser(authCtx, email, "owner", true)
	return err == nil, err
}

func (s AuthService) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now().UTC()
}

func (s AuthService) hash(token string) string {
	mac := hmac.New(sha256.New, []byte(s.Secret))
	mac.Write([]byte(token))
	return hex.EncodeToString(mac.Sum(nil))
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

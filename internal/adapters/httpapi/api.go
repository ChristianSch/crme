package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"crme/internal/authctx"
	"crme/internal/domain"
	"crme/internal/requestctx"
	"crme/internal/usecase"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type API struct {
	Auth                  usecase.AuthService
	AuthRedirectURL       string
	CookieSecure          bool
	CookieDomain          string
	AllowedOrigins        []string
	MagicLinkEmailLimiter *MemoryRateLimiter
	MagicLinkIPLimiter    *MemoryRateLimiter
	CRM                   usecase.CRMService
	AI                    usecase.AIService
	Suggestions           usecase.SuggestionService
	Email                 usecase.EmailService
	Audit                 usecase.AuditService
	Admin                 usecase.AdminService
}

func (a API) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /auth/magic-link", a.requestMagicLink)
	mux.HandleFunc("GET /auth/verify", a.verifyMagicLink)
	mux.HandleFunc("POST /auth/logout", a.logout)
	mux.HandleFunc("GET /me", a.me)
	mux.HandleFunc("GET /capabilities", a.capabilities)
	mux.HandleFunc("GET /organizations", a.listOrganizations)
	mux.HandleFunc("POST /organizations", a.createOrganization)
	mux.HandleFunc("GET /api-tokens", a.listAPITokens)
	mux.HandleFunc("POST /api-tokens", a.createAPIToken)
	mux.HandleFunc("DELETE /api-tokens/{id}", a.revokeAPIToken)
	mux.HandleFunc("GET /organizations/{id}/members", a.listOrganizationMembers)
	mux.HandleFunc("PATCH /organizations/{id}/members/{user_id}", a.updateOrganizationMember)
	mux.HandleFunc("DELETE /organizations/{id}/members/{user_id}", a.removeOrganizationMember)
	mux.HandleFunc("GET /organizations/{id}/invitations", a.listOrganizationInvitations)
	mux.HandleFunc("POST /organizations/{id}/invitations", a.inviteOrganizationMember)
	mux.HandleFunc("POST /organizations/{id}/invitations/{invitation_id}/resend", a.resendOrganizationInvitation)
	mux.HandleFunc("GET /invitations/{token}", a.getOrganizationInvitation)
	mux.HandleFunc("POST /invitations/{token}/accept", a.acceptOrganizationInvitation)
	mux.HandleFunc("GET /people", a.listPeople)
	mux.HandleFunc("POST /people", a.createPerson)
	mux.HandleFunc("GET /people/{id}", a.getPerson)
	mux.HandleFunc("PUT /people/{id}", a.updatePerson)
	mux.HandleFunc("PATCH /people/{id}", a.updatePerson)
	mux.HandleFunc("DELETE /people/{id}", a.deletePerson)
	mux.HandleFunc("GET /people/{id}/companies", a.listPersonCompanies)
	mux.HandleFunc("GET /companies", a.listCompanies)
	mux.HandleFunc("POST /companies", a.createCompany)
	mux.HandleFunc("GET /companies/{id}", a.getCompany)
	mux.HandleFunc("PUT /companies/{id}", a.updateCompany)
	mux.HandleFunc("PATCH /companies/{id}", a.updateCompany)
	mux.HandleFunc("DELETE /companies/{id}", a.deleteCompany)
	mux.HandleFunc("GET /companies/{id}/people", a.listCompanyPeople)
	mux.HandleFunc("GET /deals", a.listDeals)
	mux.HandleFunc("POST /deals", a.createDeal)
	mux.HandleFunc("GET /deals/{id}", a.getDeal)
	mux.HandleFunc("PUT /deals/{id}", a.updateDeal)
	mux.HandleFunc("PATCH /deals/{id}", a.updateDeal)
	mux.HandleFunc("DELETE /deals/{id}", a.deleteDeal)
	mux.HandleFunc("GET /deals/{id}/people", a.listDealPeople)
	mux.HandleFunc("GET /deals/{id}/companies", a.listDealCompanies)
	mux.HandleFunc("POST /relationships/person-company", a.linkPersonCompany)
	mux.HandleFunc("DELETE /relationships/person-company", a.unlinkPersonCompany)
	mux.HandleFunc("POST /relationships/deal-person", a.linkDealPerson)
	mux.HandleFunc("DELETE /relationships/deal-person", a.unlinkDealPerson)
	mux.HandleFunc("POST /relationships/deal-company", a.linkDealCompany)
	mux.HandleFunc("DELETE /relationships/deal-company", a.unlinkDealCompany)
	mux.HandleFunc("POST /activities", a.createActivity)
	mux.HandleFunc("PUT /activities/{id}", a.updateActivity)
	mux.HandleFunc("DELETE /activities/{id}", a.deleteActivity)
	mux.HandleFunc("GET /notes", a.listNotes)
	mux.HandleFunc("PUT /notes/{id}", a.updateNote)
	mux.HandleFunc("DELETE /notes/{id}", a.deleteNote)
	mux.HandleFunc("GET /timeline/{entity_type}/{entity_id}", a.timeline)
	mux.HandleFunc("GET /tags", a.listTags)
	mux.HandleFunc("POST /tags", a.createTag)
	mux.HandleFunc("POST /tags/attach", a.tagEntity)
	mux.HandleFunc("GET /workspaces", a.listWorkspaces)
	mux.HandleFunc("POST /workspaces", a.createWorkspace)
	mux.HandleFunc("GET /workspaces/{id}/entities", a.listWorkspaceEntities)
	mux.HandleFunc("POST /workspaces/link", a.linkWorkspaceEntity)
	mux.HandleFunc("GET /search", a.search)
	mux.HandleFunc("GET /tasks", a.listTodos)
	mux.HandleFunc("POST /tasks", a.createTodo)
	mux.HandleFunc("PUT /tasks/{id}", a.updateTodo)
	mux.HandleFunc("PATCH /tasks/{id}", a.updateTodo)
	mux.HandleFunc("POST /tasks/{id}/complete", a.completeTodo)
	mux.HandleFunc("DELETE /tasks/{id}", a.deleteTodo)
	mux.HandleFunc("GET /dashboard/action-items", a.dashboard)
	mux.HandleFunc("GET /ai/prompts", a.listAIPrompts)
	mux.HandleFunc("POST /ai/prompts", a.createAIPrompt)
	mux.HandleFunc("POST /ai/prompts/accept", a.acceptAIPrompt)
	mux.HandleFunc("POST /ai/prompts/link-person", a.linkSuggestionPerson)
	mux.HandleFunc("POST /ai/prompts/link-company", a.linkSuggestionCompany)
	mux.HandleFunc("POST /ai/prompts/resolve", a.resolveAIPrompt)
	mux.HandleFunc("GET /ai/conversations", a.listAssistantConversations)
	mux.HandleFunc("POST /ai/chat", a.chatAI)
	mux.HandleFunc("POST /ai/actions/execute", a.executeAssistantAction)
	mux.HandleFunc("GET /email/accounts", a.listEmailAccounts)
	mux.HandleFunc("POST /email/accounts", a.createEmailAccount)
	mux.HandleFunc("POST /email/accounts/test", a.testEmailAccount)
	mux.HandleFunc("PATCH /email/accounts/{id}", a.updateEmailAccount)
	mux.HandleFunc("DELETE /email/accounts/{id}", a.deleteEmailAccount)
	mux.HandleFunc("POST /email/sync", a.syncEmail)
	mux.HandleFunc("GET /audit-logs", a.listAuditLogs)
	mux.HandleFunc("GET /admin/stats", a.adminStats)
	return a.loggingMiddleware(a.securityMiddleware(a.authMiddleware(mux)))
}

func (a API) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		requestID := requestID(r)
		w.Header().Set("X-Request-ID", requestID)
		ctx := requestctx.WithRequestID(r.Context(), requestID)
		lrw := &loggingResponseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(lrw, r.WithContext(ctx))
		slog.InfoContext(r.Context(), "http request",
			"request_id", requestID,
			"method", r.Method,
			"path", r.URL.Path,
			"status", lrw.status,
			"bytes", lrw.bytes,
			"duration_ms", time.Since(start).Milliseconds(),
			"remote_addr", clientIP(r),
		)
	})
}

func requestID(r *http.Request) string {
	if id := strings.TrimSpace(r.Header.Get("X-Request-ID")); id != "" {
		return id
	}
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return hex.EncodeToString(b[:])
}

type loggingResponseWriter struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (w *loggingResponseWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *loggingResponseWriter) Write(b []byte) (int, error) {
	n, err := w.ResponseWriter.Write(b)
	w.bytes += n
	return n, err
}

func (a API) securityMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodOptions {
			origin := r.Header.Get("Origin")
			if origin != "" && !a.originAllowed(origin) {
				http.Error(w, "origin not allowed", http.StatusForbidden)
				return
			}
			if usesSessionCookie(r) && (origin == "" || !a.originAllowed(origin)) {
				http.Error(w, "origin required for cookie-authenticated mutations", http.StatusForbidden)
				return
			}
			if requestMayHaveBody(r) && !strings.HasPrefix(strings.ToLower(r.Header.Get("Content-Type")), "application/json") {
				http.Error(w, "content type must be application/json", http.StatusUnsupportedMediaType)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func usesSessionCookie(r *http.Request) bool {
	if r.Header.Get("X-CRM-Session") != "" {
		return false
	}
	_, err := r.Cookie("crm_session")
	return err == nil
}

func requestMayHaveBody(r *http.Request) bool {
	return (r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodPatch) && r.ContentLength != 0
}

func (a API) originAllowed(origin string) bool {
	for _, allowed := range a.AllowedOrigins {
		if strings.TrimRight(origin, "/") == strings.TrimRight(allowed, "/") {
			return true
		}
	}
	return false
}

func (a API) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" || r.URL.Path == "/auth/magic-link" || r.URL.Path == "/auth/verify" || r.URL.Path == "/auth/logout" {
			next.ServeHTTP(w, r)
			return
		}
		if token := bearerToken(r); token != "" {
			user, orgID, role, e := a.Auth.AccessAPIToken(r.Context(), token)
			if err(w, e) {
				return
			}
			if role == "viewer" && r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodOptions && !selfServiceRoute(r) {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
			ctx := authctx.WithAccess(r.Context(), authctx.Access{UserID: user.ID, UserEmail: user.Email, OrganizationID: orgID, Role: role})
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}
		sid := a.sessionID(r)
		if sid == "" {
			http.Error(w, "missing session", http.StatusUnauthorized)
			return
		}
		if a.orgOptionalRoute(r) {
			user, e := a.Auth.SessionUser(r.Context(), sid)
			if e != nil {
				http.Error(w, e.Error(), http.StatusUnauthorized)
				return
			}
			ctx := authctx.WithAccess(r.Context(), authctx.Access{UserID: user.ID, UserEmail: user.Email})
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}
		user, orgID, role, e := a.Auth.Access(r.Context(), sid, a.organizationID(r))
		if err(w, e) {
			return
		}
		if role == "viewer" && r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodOptions && !selfServiceRoute(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		ctx := authctx.WithAccess(r.Context(), authctx.Access{UserID: user.ID, UserEmail: user.Email, OrganizationID: orgID, Role: role})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func selfServiceRoute(r *http.Request) bool {
	return r.URL.Path == "/api-tokens" || strings.HasPrefix(r.URL.Path, "/api-tokens/")
}

func (a API) orgOptionalRoute(r *http.Request) bool {
	return r.URL.Path == "/me" || r.URL.Path == "/capabilities" || r.URL.Path == "/organizations" || (r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/invitations/")) || (r.Method == http.MethodPost && strings.HasPrefix(r.URL.Path, "/invitations/") && strings.HasSuffix(r.URL.Path, "/accept"))
}
func (a API) requestMagicLink(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email  string `json:"email"`
		Signup bool   `json:"signup"`
	}
	if !decode(w, r, &in) {
		return
	}
	now := time.Now().UTC()
	emailKey := "email:" + strings.ToLower(strings.TrimSpace(in.Email))
	ipKey := "ip:" + clientIP(r)
	if !a.MagicLinkEmailLimiter.Allow(emailKey, now) || !a.MagicLinkIPLimiter.Allow(ipKey, now) {
		http.Error(w, "too many magic link requests", http.StatusTooManyRequests)
		return
	}
	if err(w, a.Auth.RequestMagicLink(r.Context(), in.Email, in.Signup)) {
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]string{"status": "sent"})
}
func bearerToken(r *http.Request) string {
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if len(auth) < len("Bearer ") || !strings.EqualFold(auth[:len("Bearer ")], "Bearer ") {
		return ""
	}
	return strings.TrimSpace(auth[len("Bearer "):])
}

func (a API) sessionID(r *http.Request) domain.ID {
	sid := r.Header.Get("X-CRM-Session")
	if sid == "" {
		if c, e := r.Cookie("crm_session"); e == nil {
			sid = c.Value
		}
	}
	return domain.ID(sid)
}

func (a API) organizationID(r *http.Request) domain.ID {
	return domain.ID(strings.TrimSpace(r.URL.Query().Get("organization_id")))
}

func (a API) sessionCookie(value string, maxAge int) *http.Cookie {
	cookie := &http.Cookie{Name: "crm_session", Value: value, Path: "/", HttpOnly: true, Secure: a.CookieSecure, SameSite: http.SameSiteLaxMode, MaxAge: maxAge}
	if a.CookieDomain != "" {
		cookie.Domain = a.CookieDomain
	}
	return cookie
}

func (a API) verifyMagicLink(w http.ResponseWriter, r *http.Request) {
	id, e := a.Auth.VerifyMagicLink(r.Context(), r.URL.Query().Get("token"))
	if err(w, e) {
		return
	}
	http.SetCookie(w, a.sessionCookie(string(id), 0))
	if a.AuthRedirectURL != "" && r.URL.Query().Get("format") != "json" {
		redirectURL, e := url.Parse(strings.TrimRight(a.AuthRedirectURL, "/") + "/auth/verified")
		if err(w, e) {
			return
		}
		http.Redirect(w, r, redirectURL.String(), http.StatusSeeOther)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"session_id": string(id)})
}
func (a API) logout(w http.ResponseWriter, r *http.Request) {
	if sid := a.sessionID(r); sid != "" {
		if e := a.Auth.Logout(r.Context(), sid); e != nil {
			slog.InfoContext(r.Context(), "logout skipped for invalid session")
		}
	}
	http.SetCookie(w, a.sessionCookie("", -1))
	writeJSON(w, http.StatusOK, map[string]string{"status": "logged_out"})
}

func (a API) me(w http.ResponseWriter, r *http.Request) {
	if access, ok := authctx.AccessFrom(r.Context()); ok && access.UserID != "" && access.OrganizationID != "" {
		out, e := a.Auth.MeFromAccess(r.Context(), domain.User{ID: access.UserID, Email: access.UserEmail}, access.OrganizationID, access.Role)
		if err(w, e) {
			return
		}
		writeJSON(w, http.StatusOK, out)
		return
	}
	out, e := a.Auth.Me(r.Context(), a.sessionID(r), a.organizationID(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a API) capabilities(w http.ResponseWriter, r *http.Request) {
	if access, ok := authctx.AccessFrom(r.Context()); ok && access.Role != "" {
		writeJSON(w, http.StatusOK, a.Auth.CapabilitiesForRole(access.Role))
		return
	}
	out, e := a.Auth.Capabilities(r.Context(), a.sessionID(r), a.organizationID(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a API) listOrganizations(w http.ResponseWriter, r *http.Request) {
	if access, ok := authctx.AccessFrom(r.Context()); ok && access.UserID != "" && access.OrganizationID != "" {
		out, e := a.Auth.MeFromAccess(r.Context(), domain.User{ID: access.UserID, Email: access.UserEmail}, access.OrganizationID, access.Role)
		if err(w, e) {
			return
		}
		writeJSON(w, http.StatusOK, out.Organizations)
		return
	}
	out, e := a.Auth.Me(r.Context(), a.sessionID(r), "")
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out.Organizations)
}

func (a API) createOrganization(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name string `json:"name"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, e := a.Auth.CreateOrganization(r.Context(), a.sessionID(r), in.Name)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusCreated, out)
}

func (a API) listAPITokens(w http.ResponseWriter, r *http.Request) {
	access, ok := authctx.AccessFrom(r.Context())
	if !ok || access.UserID == "" || access.OrganizationID == "" {
		err(w, usecase.ErrUnauthorized)
		return
	}
	out, e := a.Auth.ListAPITokens(r.Context(), access.UserID, access.OrganizationID)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a API) createAPIToken(w http.ResponseWriter, r *http.Request) {
	access, ok := authctx.AccessFrom(r.Context())
	if !ok || access.UserID == "" || access.OrganizationID == "" {
		err(w, usecase.ErrUnauthorized)
		return
	}
	var in struct {
		Name string `json:"name"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, e := a.Auth.CreateAPIToken(r.Context(), access.UserID, access.OrganizationID, in.Name)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusCreated, out)
}

func (a API) revokeAPIToken(w http.ResponseWriter, r *http.Request) {
	access, ok := authctx.AccessFrom(r.Context())
	if !ok || access.UserID == "" || access.OrganizationID == "" {
		err(w, usecase.ErrUnauthorized)
		return
	}
	if e := a.Auth.RevokeAPIToken(r.Context(), access.UserID, access.OrganizationID, domain.ID(r.PathValue("id"))); err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "revoked"})
}

func (a API) listOrganizationMembers(w http.ResponseWriter, r *http.Request) {
	access, ok := authctx.AccessFrom(r.Context())
	if !ok || access.OrganizationID != domain.ID(r.PathValue("id")) {
		err(w, usecase.ErrForbidden)
		return
	}
	out, e := a.Auth.ListOrganizationMembers(r.Context(), access.Role, access.OrganizationID)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a API) updateOrganizationMember(w http.ResponseWriter, r *http.Request) {
	access, ok := authctx.AccessFrom(r.Context())
	if !ok || access.OrganizationID != domain.ID(r.PathValue("id")) {
		err(w, usecase.ErrForbidden)
		return
	}
	var in struct {
		Role string `json:"role"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, e := a.Auth.UpdateOrganizationMemberRole(r.Context(), access.Role, access.OrganizationID, domain.ID(r.PathValue("user_id")), in.Role)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a API) removeOrganizationMember(w http.ResponseWriter, r *http.Request) {
	access, ok := authctx.AccessFrom(r.Context())
	if !ok || access.OrganizationID != domain.ID(r.PathValue("id")) {
		err(w, usecase.ErrForbidden)
		return
	}
	if e := a.Auth.RemoveOrganizationMember(r.Context(), access.Role, access.OrganizationID, domain.ID(r.PathValue("user_id"))); err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "removed"})
}

func (a API) listOrganizationInvitations(w http.ResponseWriter, r *http.Request) {
	access, ok := authctx.AccessFrom(r.Context())
	if !ok || access.OrganizationID != domain.ID(r.PathValue("id")) {
		err(w, usecase.ErrForbidden)
		return
	}
	out, e := a.Auth.ListOrganizationInvitations(r.Context(), access.Role, access.OrganizationID)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a API) inviteOrganizationMember(w http.ResponseWriter, r *http.Request) {
	access, ok := authctx.AccessFrom(r.Context())
	if !ok || access.OrganizationID != domain.ID(r.PathValue("id")) {
		err(w, usecase.ErrForbidden)
		return
	}
	var in struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, e := a.Auth.InviteOrganizationMember(r.Context(), access.Role, access.OrganizationID, access.UserID, in.Email, in.Role)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusCreated, out)
}

func (a API) resendOrganizationInvitation(w http.ResponseWriter, r *http.Request) {
	access, ok := authctx.AccessFrom(r.Context())
	if !ok || access.OrganizationID != domain.ID(r.PathValue("id")) {
		err(w, usecase.ErrForbidden)
		return
	}
	out, e := a.Auth.ResendOrganizationInvitation(r.Context(), access.Role, access.OrganizationID, domain.ID(r.PathValue("invitation_id")))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a API) getOrganizationInvitation(w http.ResponseWriter, r *http.Request) {
	out, e := a.Auth.GetOrganizationInvitation(r.Context(), r.PathValue("token"))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a API) acceptOrganizationInvitation(w http.ResponseWriter, r *http.Request) {
	out, e := a.Auth.AcceptOrganizationInvitation(r.Context(), a.sessionID(r), r.PathValue("token"))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) listPeople(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.ListPeople(r.Context(), r.URL.Query().Get("q"), domain.ID(r.URL.Query().Get("workspace_id")), limit(r), offset(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type personInput struct {
	FirstName   string    `json:"first_name"`
	LastName    string    `json:"last_name"`
	Email       string    `json:"email"`
	Phone       string    `json:"phone"`
	Title       string    `json:"title"`
	LinkedInURL string    `json:"linkedin_url"`
	City        string    `json:"city"`
	Status      string    `json:"status"`
	Source      string    `json:"source"`
	MyTurn      bool      `json:"my_turn"`
	WorkspaceID domain.ID `json:"workspace_id"`
}

func (in personInput) person() domain.Person {
	return domain.Person{FirstName: in.FirstName, LastName: in.LastName, Email: in.Email, Phone: in.Phone, Title: in.Title, LinkedInURL: in.LinkedInURL, City: in.City, Status: in.Status, Source: in.Source, MyTurn: in.MyTurn}
}

type personPatchInput struct {
	FirstName   *string `json:"first_name"`
	LastName    *string `json:"last_name"`
	Email       *string `json:"email"`
	Phone       *string `json:"phone"`
	Title       *string `json:"title"`
	LinkedInURL *string `json:"linkedin_url"`
	City        *string `json:"city"`
	Status      *string `json:"status"`
	Source      *string `json:"source"`
	MyTurn      *bool   `json:"my_turn"`
}

func (in personPatchInput) zeroPerson() domain.Person {
	p := domain.Person{}
	if in.FirstName != nil {
		p.FirstName = *in.FirstName
	}
	if in.LastName != nil {
		p.LastName = *in.LastName
	}
	if in.Email != nil {
		p.Email = *in.Email
	}
	if in.Phone != nil {
		p.Phone = *in.Phone
	}
	if in.Title != nil {
		p.Title = *in.Title
	}
	if in.LinkedInURL != nil {
		p.LinkedInURL = *in.LinkedInURL
	}
	if in.City != nil {
		p.City = *in.City
	}
	if in.Status != nil {
		p.Status = *in.Status
	}
	if in.Source != nil {
		p.Source = *in.Source
	}
	if in.MyTurn != nil {
		p.MyTurn = *in.MyTurn
	}
	return p
}

func (in personPatchInput) apply(p domain.Person) domain.Person {
	if in.FirstName != nil {
		p.FirstName = *in.FirstName
	}
	if in.LastName != nil {
		p.LastName = *in.LastName
	}
	if in.Email != nil {
		p.Email = *in.Email
	}
	if in.Phone != nil {
		p.Phone = *in.Phone
	}
	if in.Title != nil {
		p.Title = *in.Title
	}
	if in.LinkedInURL != nil {
		p.LinkedInURL = *in.LinkedInURL
	}
	if in.City != nil {
		p.City = *in.City
	}
	if in.Status != nil {
		p.Status = *in.Status
	}
	if in.Source != nil {
		p.Source = *in.Source
	}
	if in.MyTurn != nil {
		p.MyTurn = *in.MyTurn
	}
	return p
}

func (a API) createPerson(w http.ResponseWriter, r *http.Request) {
	var in personInput
	if !decode(w, r, &in) {
		return
	}
	out, e := a.CRM.CreatePersonInWorkspace(r.Context(), in.person(), in.WorkspaceID)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusCreated, out)
}
func (a API) getPerson(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.GetPerson(r.Context(), domain.ID(r.PathValue("id")))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) updatePerson(w http.ResponseWriter, r *http.Request) {
	var in personPatchInput
	if !decode(w, r, &in) {
		return
	}
	id := domain.ID(r.PathValue("id"))
	var person domain.Person
	var e error
	if r.URL.Query().Get("replace") == "true" {
		person = in.zeroPerson()
	} else {
		person, e = a.CRM.GetPerson(r.Context(), id)
		if err(w, e) {
			return
		}
		person = in.apply(person)
	}
	person.ID = id
	out, e := a.CRM.ReplacePerson(r.Context(), person)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) deletePerson(w http.ResponseWriter, r *http.Request) {
	if err(w, a.CRM.DeletePerson(r.Context(), domain.ID(r.PathValue("id")))) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
func (a API) listPersonCompanies(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.ListCompaniesForPerson(r.Context(), domain.ID(r.PathValue("id")), limit(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) listCompanies(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.ListCompanies(r.Context(), r.URL.Query().Get("q"), domain.ID(r.URL.Query().Get("workspace_id")), limit(r), offset(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type companyInput struct {
	Name        string    `json:"name"`
	Domain      string    `json:"domain"`
	WorkspaceID domain.ID `json:"workspace_id"`
}

func (in companyInput) company() domain.Company {
	return domain.Company{Name: in.Name, Domain: in.Domain}
}

type companyPatchInput struct {
	Name   *string `json:"name"`
	Domain *string `json:"domain"`
}

func (in companyPatchInput) zeroCompany() domain.Company {
	c := domain.Company{}
	if in.Name != nil {
		c.Name = *in.Name
	}
	if in.Domain != nil {
		c.Domain = *in.Domain
	}
	return c
}

func (in companyPatchInput) apply(c domain.Company) domain.Company {
	if in.Name != nil {
		c.Name = *in.Name
	}
	if in.Domain != nil {
		c.Domain = *in.Domain
	}
	return c
}

func (a API) createCompany(w http.ResponseWriter, r *http.Request) {
	var in companyInput
	if !decode(w, r, &in) {
		return
	}
	out, e := a.CRM.CreateCompanyInWorkspace(r.Context(), in.company(), in.WorkspaceID)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusCreated, out)
}
func (a API) getCompany(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.GetCompany(r.Context(), domain.ID(r.PathValue("id")))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) updateCompany(w http.ResponseWriter, r *http.Request) {
	var in companyPatchInput
	if !decode(w, r, &in) {
		return
	}
	id := domain.ID(r.PathValue("id"))
	var company domain.Company
	var e error
	if r.URL.Query().Get("replace") == "true" {
		company = in.zeroCompany()
	} else {
		company, e = a.CRM.GetCompany(r.Context(), id)
		if err(w, e) {
			return
		}
		company = in.apply(company)
	}
	company.ID = id
	out, e := a.CRM.UpdateCompany(r.Context(), company)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) deleteCompany(w http.ResponseWriter, r *http.Request) {
	if err(w, a.CRM.DeleteCompany(r.Context(), domain.ID(r.PathValue("id")))) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
func (a API) listCompanyPeople(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.ListPeopleForCompany(r.Context(), domain.ID(r.PathValue("id")), limit(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) listDeals(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.ListDeals(r.Context(), r.URL.Query().Get("q"), domain.ID(r.URL.Query().Get("workspace_id")), limit(r), offset(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type dealInput struct {
	WorkspaceID domain.ID `json:"workspace_id"`
	Name        string    `json:"name"`
	Stage       string    `json:"stage"`
	ValueCents  int64     `json:"value_cents"`
	Currency    string    `json:"currency"`
}

func (in dealInput) deal() domain.Deal {
	return domain.Deal{WorkspaceID: in.WorkspaceID, Name: in.Name, Stage: in.Stage, ValueCents: in.ValueCents, Currency: in.Currency}
}

type dealPatchInput struct {
	WorkspaceID *domain.ID `json:"workspace_id"`
	Name        *string    `json:"name"`
	Stage       *string    `json:"stage"`
	ValueCents  *int64     `json:"value_cents"`
	Currency    *string    `json:"currency"`
}

func (in dealPatchInput) zeroDeal() domain.Deal {
	d := domain.Deal{}
	if in.WorkspaceID != nil {
		d.WorkspaceID = *in.WorkspaceID
	}
	if in.Name != nil {
		d.Name = *in.Name
	}
	if in.Stage != nil {
		d.Stage = *in.Stage
	}
	if in.ValueCents != nil {
		d.ValueCents = *in.ValueCents
	}
	if in.Currency != nil {
		d.Currency = *in.Currency
	}
	return d
}

func (in dealPatchInput) apply(d domain.Deal) domain.Deal {
	if in.WorkspaceID != nil {
		d.WorkspaceID = *in.WorkspaceID
	}
	if in.Name != nil {
		d.Name = *in.Name
	}
	if in.Stage != nil {
		d.Stage = *in.Stage
	}
	if in.ValueCents != nil {
		d.ValueCents = *in.ValueCents
	}
	if in.Currency != nil {
		d.Currency = *in.Currency
	}
	return d
}

func (a API) createDeal(w http.ResponseWriter, r *http.Request) {
	var in dealInput
	if !decode(w, r, &in) {
		return
	}
	out, e := a.CRM.CreateDeal(r.Context(), in.deal())
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusCreated, out)
}
func (a API) getDeal(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.GetDeal(r.Context(), domain.ID(r.PathValue("id")))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) updateDeal(w http.ResponseWriter, r *http.Request) {
	var in dealPatchInput
	if !decode(w, r, &in) {
		return
	}
	id := domain.ID(r.PathValue("id"))
	var deal domain.Deal
	var e error
	if r.URL.Query().Get("replace") == "true" {
		deal = in.zeroDeal()
	} else {
		deal, e = a.CRM.GetDeal(r.Context(), id)
		if err(w, e) {
			return
		}
		deal = in.apply(deal)
	}
	deal.ID = id
	out, e := a.CRM.UpdateDeal(r.Context(), deal)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) deleteDeal(w http.ResponseWriter, r *http.Request) {
	if err(w, a.CRM.DeleteDeal(r.Context(), domain.ID(r.PathValue("id")))) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
func (a API) listDealPeople(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.ListPeopleForDeal(r.Context(), domain.ID(r.PathValue("id")), limit(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) listDealCompanies(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.ListCompaniesForDeal(r.Context(), domain.ID(r.PathValue("id")), limit(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) linkPersonCompany(w http.ResponseWriter, r *http.Request) {
	var in struct {
		PersonID  domain.ID `json:"person_id"`
		CompanyID domain.ID `json:"company_id"`
		Role      string    `json:"role"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err(w, a.CRM.LinkPersonCompany(r.Context(), in.PersonID, in.CompanyID, in.Role)) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
func (a API) unlinkPersonCompany(w http.ResponseWriter, r *http.Request) {
	var in struct {
		PersonID  domain.ID `json:"person_id"`
		CompanyID domain.ID `json:"company_id"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err(w, a.CRM.UnlinkPersonCompany(r.Context(), in.PersonID, in.CompanyID)) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
func (a API) linkDealPerson(w http.ResponseWriter, r *http.Request) {
	var in struct {
		DealID   domain.ID `json:"deal_id"`
		PersonID domain.ID `json:"person_id"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err(w, a.CRM.LinkDealPerson(r.Context(), in.DealID, in.PersonID)) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
func (a API) unlinkDealPerson(w http.ResponseWriter, r *http.Request) {
	var in struct {
		DealID   domain.ID `json:"deal_id"`
		PersonID domain.ID `json:"person_id"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err(w, a.CRM.UnlinkDealPerson(r.Context(), in.DealID, in.PersonID)) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
func (a API) linkDealCompany(w http.ResponseWriter, r *http.Request) {
	var in struct {
		DealID    domain.ID `json:"deal_id"`
		CompanyID domain.ID `json:"company_id"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err(w, a.CRM.LinkDealCompany(r.Context(), in.DealID, in.CompanyID)) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
func (a API) unlinkDealCompany(w http.ResponseWriter, r *http.Request) {
	var in struct {
		DealID    domain.ID `json:"deal_id"`
		CompanyID domain.ID `json:"company_id"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err(w, a.CRM.UnlinkDealCompany(r.Context(), in.DealID, in.CompanyID)) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type activityInput struct {
	Type       domain.ActivityType `json:"type"`
	Body       string              `json:"body"`
	OccurredAt time.Time           `json:"occurred_at"`
}

type activityLinkInput struct {
	EntityType domain.EntityType `json:"entity_type"`
	EntityID   domain.ID         `json:"entity_id"`
}

func (in activityInput) activity() domain.Activity {
	return domain.Activity{Type: in.Type, Body: in.Body, OccurredAt: in.OccurredAt}
}

func (in activityLinkInput) link() domain.ActivityLink {
	return domain.ActivityLink{EntityType: in.EntityType, EntityID: in.EntityID}
}

func (a API) createActivity(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Activity activityInput       `json:"activity"`
		Links    []activityLinkInput `json:"links"`
	}
	if !decode(w, r, &in) {
		return
	}
	links := make([]domain.ActivityLink, 0, len(in.Links))
	for _, l := range in.Links {
		links = append(links, l.link())
	}
	out, e := a.CRM.CreateActivity(r.Context(), in.Activity.activity(), links)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusCreated, out)
}
func (a API) updateActivity(w http.ResponseWriter, r *http.Request) {
	var in activityInput
	if !decode(w, r, &in) {
		return
	}
	activity := in.activity()
	activity.ID = domain.ID(r.PathValue("id"))
	out, e := a.CRM.UpdateActivity(r.Context(), activity)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) deleteActivity(w http.ResponseWriter, r *http.Request) {
	if err(w, a.CRM.DeleteActivity(r.Context(), domain.ID(r.PathValue("id")))) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
func (a API) updateNote(w http.ResponseWriter, r *http.Request) {
	var in activityInput
	if !decode(w, r, &in) {
		return
	}
	activity := in.activity()
	activity.ID = domain.ID(r.PathValue("id"))
	out, e := a.CRM.UpdateNote(r.Context(), activity)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) deleteNote(w http.ResponseWriter, r *http.Request) {
	if err(w, a.CRM.DeleteNote(r.Context(), domain.ID(r.PathValue("id")))) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
func (a API) timeline(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.Timeline(r.Context(), domain.EntityType(r.PathValue("entity_type")), domain.ID(r.PathValue("entity_id")), limit(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) listTags(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.ListTags(r.Context(), limit(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type tagInput struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

func (in tagInput) tag() domain.Tag {
	return domain.Tag{Name: in.Name, Color: in.Color}
}

func (a API) createTag(w http.ResponseWriter, r *http.Request) {
	var in tagInput
	if !decode(w, r, &in) {
		return
	}
	out, e := a.CRM.CreateTag(r.Context(), in.tag())
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusCreated, out)
}
func (a API) tagEntity(w http.ResponseWriter, r *http.Request) {
	var in struct {
		TagID      domain.ID         `json:"tag_id"`
		EntityType domain.EntityType `json:"entity_type"`
		EntityID   domain.ID         `json:"entity_id"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err(w, a.CRM.TagEntity(r.Context(), in.TagID, in.EntityType, in.EntityID)) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
func (a API) listWorkspaces(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.ListWorkspaces(r.Context(), limit(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type workspaceInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (in workspaceInput) workspace() domain.Workspace {
	return domain.Workspace{Name: in.Name, Description: in.Description}
}

func (a API) createWorkspace(w http.ResponseWriter, r *http.Request) {
	var in workspaceInput
	if !decode(w, r, &in) {
		return
	}
	out, e := a.CRM.CreateWorkspace(r.Context(), in.workspace())
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusCreated, out)
}
func (a API) listWorkspaceEntities(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.ListWorkspaceEntities(r.Context(), domain.ID(r.PathValue("id")), domain.EntityType(r.URL.Query().Get("entity_type")), limit(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) linkWorkspaceEntity(w http.ResponseWriter, r *http.Request) {
	var in struct {
		WorkspaceID domain.ID         `json:"workspace_id"`
		EntityType  domain.EntityType `json:"entity_type"`
		EntityID    domain.ID         `json:"entity_id"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err(w, a.CRM.LinkWorkspaceEntity(r.Context(), in.WorkspaceID, in.EntityType, in.EntityID)) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
func (a API) search(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.Search(r.Context(), r.URL.Query().Get("q"), limit(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) listTodos(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.ListTodos(r.Context(), r.URL.Query().Get("q"), r.URL.Query().Get("status"), r.URL.Query().Get("due"), domain.EntityType(r.URL.Query().Get("entity_type")), domain.ID(r.URL.Query().Get("entity_id")), domain.ID(r.URL.Query().Get("workspace_id")), limit(r), offset(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) listNotes(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.ListNotes(r.Context(), limit(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type todoInput struct {
	WorkspaceID domain.ID           `json:"workspace_id"`
	EntityType  domain.EntityType   `json:"entity_type"`
	EntityID    domain.ID           `json:"entity_id"`
	Title       string              `json:"title"`
	Body        string              `json:"body"`
	DueAt       *time.Time          `json:"due_at"`
	Priority    domain.TodoPriority `json:"priority"`
	Status      domain.TodoStatus   `json:"status"`
}

func (in todoInput) todo() domain.Todo {
	return domain.Todo{WorkspaceID: in.WorkspaceID, EntityType: in.EntityType, EntityID: in.EntityID, Title: in.Title, Body: in.Body, DueAt: in.DueAt, Priority: in.Priority, Status: in.Status}
}

type todoPatchInput struct {
	WorkspaceID *domain.ID           `json:"workspace_id"`
	EntityType  *domain.EntityType   `json:"entity_type"`
	EntityID    *domain.ID           `json:"entity_id"`
	Title       *string              `json:"title"`
	Body        *string              `json:"body"`
	DueAt       *time.Time           `json:"due_at"`
	Priority    *domain.TodoPriority `json:"priority"`
	Status      *domain.TodoStatus   `json:"status"`
}

func (in todoPatchInput) zeroTodo() domain.Todo {
	t := domain.Todo{}
	if in.WorkspaceID != nil {
		t.WorkspaceID = *in.WorkspaceID
	}
	if in.EntityType != nil {
		t.EntityType = *in.EntityType
	}
	if in.EntityID != nil {
		t.EntityID = *in.EntityID
	}
	if in.Title != nil {
		t.Title = *in.Title
	}
	if in.Body != nil {
		t.Body = *in.Body
	}
	if in.DueAt != nil {
		t.DueAt = in.DueAt
	}
	if in.Priority != nil {
		t.Priority = *in.Priority
	}
	if in.Status != nil {
		t.Status = *in.Status
	}
	return t
}

func (in todoPatchInput) apply(t domain.Todo) domain.Todo {
	if in.WorkspaceID != nil {
		t.WorkspaceID = *in.WorkspaceID
	}
	if in.EntityType != nil {
		t.EntityType = *in.EntityType
	}
	if in.EntityID != nil {
		t.EntityID = *in.EntityID
	}
	if in.Title != nil {
		t.Title = *in.Title
	}
	if in.Body != nil {
		t.Body = *in.Body
	}
	if in.DueAt != nil {
		t.DueAt = in.DueAt
	}
	if in.Priority != nil {
		t.Priority = *in.Priority
	}
	if in.Status != nil {
		t.Status = *in.Status
	}
	return t
}

func (a API) createTodo(w http.ResponseWriter, r *http.Request) {
	var in todoInput
	if !decode(w, r, &in) {
		return
	}
	out, e := a.CRM.CreateTodo(r.Context(), in.todo())
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusCreated, out)
}
func (a API) updateTodo(w http.ResponseWriter, r *http.Request) {
	var in todoPatchInput
	if !decode(w, r, &in) {
		return
	}
	id := domain.ID(r.PathValue("id"))
	var todo domain.Todo
	var e error
	if r.URL.Query().Get("replace") == "true" {
		todo = in.zeroTodo()
	} else {
		todo, e = a.CRM.GetTodo(r.Context(), id)
		if err(w, e) {
			return
		}
		todo = in.apply(todo)
	}
	todo.ID = id
	out, e := a.CRM.UpdateTodo(r.Context(), todo)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) completeTodo(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.CompleteTodo(r.Context(), domain.ID(r.PathValue("id")))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) deleteTodo(w http.ResponseWriter, r *http.Request) {
	if err(w, a.CRM.DeleteTodo(r.Context(), domain.ID(r.PathValue("id")))) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
func (a API) dashboard(w http.ResponseWriter, r *http.Request) {
	out, e := a.CRM.Dashboard(r.Context(), limit(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) listAIPrompts(w http.ResponseWriter, r *http.Request) {
	out, e := a.Suggestions.ListPrompts(r.Context(), r.URL.Query().Get("status"), limit(r), offset(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) listAssistantConversations(w http.ResponseWriter, r *http.Request) {
	out, e := a.AI.ListConversations(r.Context(), a.sessionID(r), limit(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a API) chatAI(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ConversationID domain.ID          `json:"conversation_id"`
		Messages       []domain.AIMessage `json:"messages"`
	}
	if !decode(w, r, &in) {
		return
	}
	conversationID := in.ConversationID
	if conversationID == "" {
		var e error
		conversationID, e = newUUID()
		if err(w, e) {
			return
		}
	}
	ctx := requestctx.WithSessionID(r.Context(), string(a.sessionID(r)))
	ctx = requestctx.WithAssistantConversationID(ctx, string(conversationID))
	out, e := a.AI.Chat(ctx, in.Messages)
	if err(w, e) {
		return
	}
	conversationMessages := append([]domain.AIMessage(nil), in.Messages...)
	conversationMessages = append(conversationMessages, domain.AIMessage{Role: "assistant", Content: assistantStoredMessageContent(out)})
	conversation, e := a.AI.SaveConversation(ctx, domain.AssistantConversation{ID: conversationID, SessionID: a.sessionID(r), Messages: conversationMessages, PendingAction: out.PendingAction})
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, struct {
		domain.AICompletion
		ConversationID domain.ID `json:"conversation_id"`
	}{AICompletion: out, ConversationID: conversation.ID})
}

func newUUID() (domain.ID, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return domain.ID(fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])), nil
}

func assistantStoredMessageContent(out domain.AICompletion) string {
	if len(out.Entities) == 0 {
		return out.Text
	}
	raw, err := json.Marshal(out.Entities)
	if err != nil {
		return out.Text
	}
	return out.Text + "\n\nASSISTANT_ENTITIES:" + string(raw)
}

func (a API) executeAssistantAction(w http.ResponseWriter, r *http.Request) {
	var action domain.AIAction
	if !decode(w, r, &action) {
		return
	}
	if action.Command == "email-sync" {
		out, e := a.Email.SyncAccounts(r.Context(), limit(r))
		if err(w, e) {
			return
		}
		writeJSON(w, http.StatusOK, out)
		return
	}
	out, e := a.AI.ExecuteAction(r.Context(), action)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) createAIPrompt(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Kind       domain.AIPromptKind `json:"kind"`
		EntityType domain.EntityType   `json:"entity_type"`
		EntityID   domain.ID           `json:"entity_id"`
		Context    string              `json:"context"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, e := a.AI.DraftPrompt(r.Context(), in.Kind, in.EntityType, in.EntityID, in.Context)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusCreated, out)
}
func (a API) resolveAIPrompt(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ID       domain.ID `json:"id"`
		Status   string    `json:"status"`
		Suppress bool      `json:"suppress"`
	}
	if !decode(w, r, &in) {
		return
	}
	var out domain.AIPrompt
	var e error
	if in.Suppress {
		out, e = a.Suggestions.SuppressPrompt(r.Context(), in.ID)
	} else if in.Status == "open" {
		out, e = a.Suggestions.UnsuppressPrompt(r.Context(), in.ID)
	} else {
		out, e = a.Suggestions.ResolvePrompt(r.Context(), in.ID, in.Status)
	}
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) acceptAIPrompt(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ID domain.ID `json:"id"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, e := a.Suggestions.AcceptPrompt(r.Context(), in.ID)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) linkSuggestionPerson(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ID       domain.ID `json:"id"`
		PersonID domain.ID `json:"person_id"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, e := a.Suggestions.LinkSuggestionToPerson(r.Context(), in.ID, in.PersonID)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) linkSuggestionCompany(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ID        domain.ID `json:"id"`
		CompanyID domain.ID `json:"company_id"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, e := a.Suggestions.LinkSuggestionToCompany(r.Context(), in.ID, in.CompanyID)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) listEmailAccounts(w http.ResponseWriter, r *http.Request) {
	out, e := a.Email.ListAccounts(r.Context(), limit(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type emailAccountInput struct {
	Name         string `json:"name"`
	Email        string `json:"email"`
	IMAPHost     string `json:"imap_host"`
	IMAPPort     int    `json:"imap_port"`
	IMAPUsername string `json:"imap_username"`
	SMTPHost     string `json:"smtp_host"`
	SMTPPort     int    `json:"smtp_port"`
	SMTPUsername string `json:"smtp_username"`
	Secret       string `json:"secret"`
	SyncEnabled  bool   `json:"sync_enabled"`
}

func (in emailAccountInput) account() domain.EmailAccount {
	return domain.EmailAccount{Name: in.Name, Email: in.Email, IMAPHost: in.IMAPHost, IMAPPort: in.IMAPPort, IMAPUsername: in.IMAPUsername, SMTPHost: in.SMTPHost, SMTPPort: in.SMTPPort, SMTPUsername: in.SMTPUsername, Secret: in.Secret, SyncEnabled: in.SyncEnabled}
}

func (a API) createEmailAccount(w http.ResponseWriter, r *http.Request) {
	var in emailAccountInput
	if !decode(w, r, &in) {
		return
	}
	out, e := a.Email.CreateAccount(r.Context(), in.account())
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusCreated, out)
}
func (a API) testEmailAccount(w http.ResponseWriter, r *http.Request) {
	var in emailAccountInput
	if !decode(w, r, &in) {
		return
	}
	if err(w, a.Email.TestAccount(r.Context(), in.account())) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
func (a API) updateEmailAccount(w http.ResponseWriter, r *http.Request) {
	var in emailAccountInput
	if !decode(w, r, &in) {
		return
	}
	account := in.account()
	account.ID = domain.ID(r.PathValue("id"))
	out, e := a.Email.UpdateAccount(r.Context(), account)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) deleteEmailAccount(w http.ResponseWriter, r *http.Request) {
	if err(w, a.Email.DeleteAccount(r.Context(), domain.ID(r.PathValue("id")))) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
func (a API) syncEmail(w http.ResponseWriter, r *http.Request) {
	out, e := a.Email.SyncAccounts(r.Context(), limit(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func (a API) listAuditLogs(w http.ResponseWriter, r *http.Request) {
	access, ok := authctx.AccessFrom(r.Context())
	if !ok || access.OrganizationID == "" {
		err(w, usecase.ErrUnauthorized)
		return
	}
	out, e := a.Audit.ListAuditLogs(r.Context(), access.Role, access.OrganizationID, limit(r), offset(r))
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a API) adminStats(w http.ResponseWriter, r *http.Request) {
	access, ok := authctx.AccessFrom(r.Context())
	if !ok || access.OrganizationID == "" {
		err(w, usecase.ErrUnauthorized)
		return
	}
	out, e := a.Admin.Stats(r.Context(), access.Role, access.OrganizationID)
	if err(w, e) {
		return
	}
	writeJSON(w, http.StatusOK, out)
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if e := json.NewDecoder(r.Body).Decode(v); e != nil {
		http.Error(w, e.Error(), http.StatusBadRequest)
		return false
	}
	return true
}
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func err(w http.ResponseWriter, e error) bool {
	if e == nil {
		return false
	}
	status, message := errorResponse(e)
	if status == http.StatusInternalServerError {
		slog.Error("request failed", "error", e)
	}
	http.Error(w, message, status)
	return true
}

func errorResponse(e error) (int, string) {
	if errors.Is(e, usecase.ErrValidation) {
		return http.StatusBadRequest, e.Error()
	}
	if errors.Is(e, usecase.ErrUnauthorized) {
		return http.StatusUnauthorized, "unauthorized"
	}
	if errors.Is(e, usecase.ErrForbidden) {
		return http.StatusForbidden, "forbidden"
	}
	if errors.Is(e, usecase.ErrNotFound) || errors.Is(e, pgx.ErrNoRows) {
		return http.StatusNotFound, "not found"
	}
	if errors.Is(e, usecase.ErrConflict) {
		return http.StatusConflict, "conflict"
	}
	if errors.Is(e, context.Canceled) {
		return http.StatusRequestTimeout, "request canceled"
	}
	var pgErr *pgconn.PgError
	if errors.As(e, &pgErr) {
		switch pgErr.Code {
		case "23505":
			return http.StatusConflict, "conflict"
		case "23503":
			return http.StatusBadRequest, "invalid reference"
		case "22P02":
			return http.StatusBadRequest, "invalid input"
		}
	}
	return http.StatusInternalServerError, "internal server error"
}
func limit(r *http.Request) int  { n, _ := strconv.Atoi(r.URL.Query().Get("limit")); return n }
func offset(r *http.Request) int { n, _ := strconv.Atoi(r.URL.Query().Get("offset")); return n }

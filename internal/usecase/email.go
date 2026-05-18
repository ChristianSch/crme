package usecase

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"crme/internal/authctx"
	"crme/internal/domain"
	"crme/internal/ports"
	"crme/internal/secrets"
)

type EmailService struct {
	UOW            ports.UnitOfWork
	Accounts       ports.EmailAccountStore
	Messages       ports.EmailMessageStore
	People         ports.PersonStore
	Companies      ports.CompanyStore
	Activities     ports.ActivityStore
	Prompts        ports.AIPromptStore
	Secrets        ports.RuntimeSecretStore
	Audit          ports.AuditLogStore
	Box            *secrets.Box
	SecretResolver ports.SecretResolver
	Fetcher        ports.MailFetcher
	Tester         ports.EmailAccountTester
}

func (s EmailService) CreateAccount(ctx context.Context, a domain.EmailAccount) (domain.EmailAccount, error) {
	a, err := validateEmailAccountInput(a, true)
	if err != nil {
		return a, err
	}
	if strings.TrimSpace(a.Secret) == "" {
		return a, fmt.Errorf("%w: password is required", ErrValidation)
	}
	if err := s.testAccount(ctx, a, a.Secret); err != nil {
		return a, err
	}
	// Default new accounts to syncing. Disable later once update support exists.
	if !a.SyncEnabled {
		a.SyncEnabled = true
	}
	if a.Secret != "" {
		if s.Box == nil || s.Secrets == nil {
			return a, fmt.Errorf("%w: CRME_SECRET_KEY is required to store email passwords", ErrValidation)
		}
		ciphertext, nonce, err := s.Box.Encrypt(a.Secret, []byte("email_account:password"))
		if err != nil {
			return a, err
		}
		secretID, err := s.Secrets.CreateRuntimeSecret(ctx, "email_account", "password", ciphertext, nonce)
		if err != nil {
			return a, err
		}
		a.SecretRef = "runtime_secret:" + string(secretID)
		a.Secret = ""
	}
	account, err := s.Accounts.CreateEmailAccount(ctx, a)
	if err != nil {
		return account, err
	}
	recordAudit(ctx, s.Audit, domain.AuditLog{OrganizationID: account.OrganizationID, Action: "email_account.created", TargetType: "email_account", TargetID: account.ID, Details: map[string]any{"email": account.Email, "sync_enabled": account.SyncEnabled}})
	return account, nil
}

func (s EmailService) ListAccounts(ctx context.Context, limit int) ([]domain.EmailAccount, error) {
	return s.Accounts.ListEmailAccounts(ctx, saneLimit(limit))
}

func (s EmailService) TestAccount(ctx context.Context, a domain.EmailAccount) error {
	a, err := validateEmailAccountInput(a, true)
	if err != nil {
		return err
	}
	if strings.TrimSpace(a.Secret) == "" {
		return fmt.Errorf("%w: password is required", ErrValidation)
	}
	return s.testAccount(ctx, a, a.Secret)
}

func (s EmailService) UpdateAccount(ctx context.Context, a domain.EmailAccount) (domain.EmailAccount, error) {
	if a.ID == "" {
		return a, fmt.Errorf("%w: account id is required", ErrValidation)
	}
	a, err := validateEmailAccountInput(a, true)
	if err != nil {
		return a, err
	}
	secret := strings.TrimSpace(a.Secret)
	if secret == "" {
		if s.SecretResolver == nil {
			return a, fmt.Errorf("runtime secret resolver is not configured")
		}
		existing, err := s.Accounts.GetEmailAccount(ctx, a.ID)
		if err != nil {
			return a, err
		}
		secret, err = s.SecretResolver.Resolve(ctx, existing.SecretRef)
		if err != nil {
			return a, err
		}
	}
	if err := s.testAccount(ctx, a, secret); err != nil {
		return a, err
	}
	if a.Secret != "" {
		if s.Box == nil || s.Secrets == nil {
			return a, fmt.Errorf("%w: CRME_SECRET_KEY is required to store email passwords", ErrValidation)
		}
		ciphertext, nonce, err := s.Box.Encrypt(a.Secret, []byte("email_account:password"))
		if err != nil {
			return a, err
		}
		secretID, err := s.Secrets.CreateRuntimeSecret(ctx, "email_account", "password", ciphertext, nonce)
		if err != nil {
			return a, err
		}
		a.SecretRef = "runtime_secret:" + string(secretID)
		a.Secret = ""
	}
	account, err := s.Accounts.UpdateEmailAccount(ctx, a)
	if err != nil {
		return account, err
	}
	recordAudit(ctx, s.Audit, domain.AuditLog{OrganizationID: account.OrganizationID, Action: "email_account.updated", TargetType: "email_account", TargetID: account.ID, Details: map[string]any{"email": account.Email, "sync_enabled": account.SyncEnabled}})
	return account, nil
}

func (s EmailService) DeleteAccount(ctx context.Context, id domain.ID) error {
	if id == "" {
		return fmt.Errorf("%w: account id is required", ErrValidation)
	}
	if err := s.Accounts.DeleteEmailAccount(ctx, id); err != nil {
		return err
	}
	recordAudit(ctx, s.Audit, domain.AuditLog{Action: "email_account.deleted", TargetType: "email_account", TargetID: id})
	return nil
}

func (s EmailService) testAccount(ctx context.Context, a domain.EmailAccount, secret string) error {
	if s.Tester == nil {
		return fmt.Errorf("email account tester is not configured")
	}
	return s.Tester.TestEmailAccount(ctx, a, secret)
}

func validateEmailAccountInput(a domain.EmailAccount, requireEmail bool) (domain.EmailAccount, error) {
	a.Name = strings.TrimSpace(a.Name)
	a.Email = strings.ToLower(strings.TrimSpace(a.Email))
	if requireEmail && (a.Email == "" || !strings.Contains(a.Email, "@")) {
		return a, fmt.Errorf("%w: valid email is required", ErrValidation)
	}
	a.IMAPHost = strings.TrimSpace(a.IMAPHost)
	if a.IMAPHost == "" {
		return a, fmt.Errorf("%w: IMAP host is required", ErrValidation)
	}
	if a.IMAPPort == 0 {
		a.IMAPPort = 993
	}
	a.IMAPUsername = strings.TrimSpace(a.IMAPUsername)
	a.SMTPHost = strings.TrimSpace(a.SMTPHost)
	if a.SMTPPort == 0 {
		a.SMTPPort = 587
	}
	a.SMTPUsername = strings.TrimSpace(a.SMTPUsername)
	return a, nil
}

func (s EmailService) withStores(stores ports.Stores) EmailService {
	s.Accounts = stores.EmailAccounts
	s.Messages = stores.EmailMessages
	s.People = stores.People
	s.Companies = stores.Companies
	s.Activities = stores.Activities
	s.Prompts = stores.Prompts
	return s
}

func (s EmailService) SyncAccounts(ctx context.Context, limit int) (EmailSyncReport, error) {
	if s.SecretResolver == nil || s.Fetcher == nil {
		return EmailSyncReport{}, fmt.Errorf("email sync is not configured")
	}
	accounts, err := s.Accounts.ListSyncEnabledEmailAccounts(authctx.WithSystemAccess(ctx), saneLimit(limit))
	if err != nil {
		return EmailSyncReport{}, err
	}
	report := EmailSyncReport{Accounts: len(accounts)}
	for _, account := range accounts {
		accountCtx := ctx
		if account.OrganizationID != "" && account.OwnerUserID != "" {
			accountCtx = authctx.WithAccess(ctx, authctx.Access{UserID: account.OwnerUserID, OrganizationID: account.OrganizationID, Role: "member"})
		}
		secret, err := s.SecretResolver.Resolve(accountCtx, account.SecretRef)
		if err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("%s: %v", account.Email, err))
			continue
		}
		since := time.Time{}
		if account.LastSyncedAt != nil {
			since = *account.LastSyncedAt
		}
		messages, err := s.Fetcher.FetchNewMessages(ctx, account, secret, since, 100)
		if err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("%s: %v", account.Email, err))
			continue
		}
		for _, m := range messages {
			created, linked, suggestions, err := s.processFetchedMessage(accountCtx, account, m)
			if err != nil {
				report.Errors = append(report.Errors, fmt.Sprintf("%s: process %s: %v", account.Email, m.MessageID, err))
				continue
			}
			if created {
				report.NewMessages++
			}
			if linked {
				report.LinkedMessages++
			}
			report.Suggestions += suggestions
		}
		if err := s.Accounts.MarkEmailAccountSynced(accountCtx, account.ID, time.Now().UTC()); err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("%s: mark synced: %v", account.Email, err))
		}
	}
	return report, nil
}

func (s EmailService) processFetchedMessage(ctx context.Context, account domain.EmailAccount, m domain.EmailMessage) (bool, bool, int, error) {
	if s.UOW == nil {
		return s.processFetchedMessageNoTx(ctx, account, m)
	}
	var created bool
	var linked bool
	var suggestions int
	err := s.UOW.WithinTx(ctx, func(stores ports.Stores) error {
		var err error
		created, linked, suggestions, err = s.withStores(stores).processFetchedMessageNoTx(ctx, account, m)
		return err
	})
	return created, linked, suggestions, err
}

func (s EmailService) processFetchedMessageNoTx(ctx context.Context, account domain.EmailAccount, m domain.EmailMessage) (bool, bool, int, error) {
	created, err := s.Messages.UpsertEmailMessage(ctx, m)
	if err != nil {
		return false, false, 0, err
	}
	if !created {
		return false, false, 0, nil
	}
	linked, err := s.linkEmailToTimeline(ctx, account, m)
	if err != nil {
		return false, false, 0, err
	}
	suggestions, err := s.suggestEntitiesFromMessage(ctx, account, m)
	if err != nil {
		return false, false, 0, err
	}
	return true, linked, suggestions, nil
}

func (s EmailService) linkEmailToTimeline(ctx context.Context, account domain.EmailAccount, m domain.EmailMessage) (bool, error) {
	links := map[string]domain.ActivityLink{}
	touchPeople := map[domain.ID]time.Time{}
	touchCompanies := map[domain.ID]time.Time{}
	for _, email := range relevantEmails(account, m) {
		if person, found, err := s.People.FindPersonByEmail(ctx, email); err != nil {
			return false, err
		} else if found {
			links["person:"+string(person.ID)] = domain.ActivityLink{EntityType: domain.EntityPerson, EntityID: person.ID}
			touchPeople[person.ID] = m.SentAt
		}
		domainName := emailDomain(email)
		if domainName == "" || isPersonalEmailDomain(domainName) {
			continue
		}
		if company, found, err := s.Companies.FindCompanyByDomain(ctx, domainName); err != nil {
			return false, err
		} else if found {
			links["company:"+string(company.ID)] = domain.ActivityLink{EntityType: domain.EntityCompany, EntityID: company.ID}
			touchCompanies[company.ID] = m.SentAt
		}
	}
	if len(links) == 0 {
		return false, nil
	}
	activityLinks := make([]domain.ActivityLink, 0, len(links))
	for _, l := range links {
		activityLinks = append(activityLinks, l)
	}
	body := sanitizedEmailActivityBody(m)
	privateBody := fullEmailActivityBody(m)
	activity, err := s.Activities.CreateActivity(ctx, domain.Activity{Type: domain.ActivityEmail, Body: body, OccurredAt: m.SentAt}, activityLinks)
	if err != nil {
		return false, err
	}
	if account.OwnerUserID != "" && privateBody != "" {
		if err := s.Activities.CreateActivityDetail(ctx, domain.ActivityDetail{ActivityID: activity.ID, OwnerUserID: account.OwnerUserID, BodyText: privateBody}); err != nil {
			return false, err
		}
	}
	if err := s.Messages.SetEmailMessageActivity(ctx, m.MessageID, activity.ID); err != nil {
		return false, err
	}
	for id, at := range touchPeople {
		if err := s.People.TouchPerson(ctx, id, at); err != nil {
			return false, err
		}
	}
	for id, at := range touchCompanies {
		if err := s.Companies.TouchCompany(ctx, id, at); err != nil {
			return false, err
		}
	}
	return true, nil
}

func (s EmailService) suggestEntitiesFromMessage(ctx context.Context, account domain.EmailAccount, m domain.EmailMessage) (int, error) {
	from := strings.ToLower(strings.TrimSpace(m.FromEmail))
	if from == "" || from == strings.ToLower(account.Email) {
		return 0, nil
	}
	created := 0
	if _, found, err := s.People.FindPersonByEmail(ctx, from); err != nil {
		return created, err
	} else if !found {
		if suppressed, err := s.Prompts.IsSuggestionSuppressed(ctx, domain.PromptNewContact, "email", from); err != nil || suppressed {
			return created, err
		}
		title := "New contact: " + from
		exists, err := s.Prompts.AIPromptExists(ctx, domain.PromptNewContact, title, "open")
		if err != nil {
			return created, err
		}
		if !exists {
			enrichment := enrichContactFromEmail(m)
			body := contactSuggestionBody(from, emailDomain(from), m, enrichment)
			_, err := s.Prompts.CreateAIPrompt(ctx, domain.AIPrompt{
				Kind:             domain.PromptNewContact,
				TargetType:       "email",
				TargetIdentifier: from,
				Title:            title,
				Body:             body,
				Status:           "open",
				LastTouchAt:      &m.SentAt,
			})
			if err != nil {
				return created, err
			}
			created++
		}
	}
	domainName := emailDomain(from)
	if domainName == "" || isPersonalEmailDomain(domainName) {
		return created, nil
	}
	if _, found, err := s.Companies.FindCompanyByDomain(ctx, domainName); err != nil {
		return created, err
	} else if !found {
		if suppressed, err := s.Prompts.IsSuggestionSuppressed(ctx, domain.PromptNewCompany, "domain", domainName); err != nil || suppressed {
			return created, err
		}
		title := "New company: " + domainName
		exists, err := s.Prompts.AIPromptExists(ctx, domain.PromptNewCompany, title, "open")
		if err != nil {
			return created, err
		}
		if !exists {
			_, err := s.Prompts.CreateAIPrompt(ctx, domain.AIPrompt{
				Kind:             domain.PromptNewCompany,
				TargetType:       "domain",
				TargetIdentifier: domainName,
				Title:            title,
				Body:             fmt.Sprintf("Inbound email from %s\nSubject: %s\n\nReview and create/link a company for domain %s if relevant.", from, m.Subject, domainName),
				Status:           "open",
				LastTouchAt:      &m.SentAt,
			})
			if err != nil {
				return created, err
			}
			created++
		}
	}
	return created, nil
}

type contactEnrichment struct {
	Name     string
	Phone    string
	LinkedIn string
	Website  string
	Title    string
	Context  string
}

func enrichContactFromEmail(m domain.EmailMessage) contactEnrichment {
	body := strings.TrimSpace(m.BodyText)
	return contactEnrichment{
		Name:     strings.TrimSpace(m.FromName),
		Phone:    firstMatch(phonePattern, body),
		LinkedIn: firstMatch(linkedinPattern, body),
		Website:  firstUsefulWebsite(body),
		Title:    likelyTitle(body),
		Context:  truncateText(cleanEmailText(body), 700),
	}
}

func contactSuggestionBody(from string, domainName string, m domain.EmailMessage, e contactEnrichment) string {
	lines := []string{}
	if e.Name != "" {
		lines = append(lines, "Name: "+e.Name)
	}
	lines = append(lines, "Email: "+from)
	if domainName != "" {
		lines = append(lines, "Suggested company domain: "+domainName)
	}
	if e.Title != "" {
		lines = append(lines, "Possible title: "+e.Title)
	}
	if e.Phone != "" {
		lines = append(lines, "Phone: "+e.Phone)
	}
	if e.LinkedIn != "" {
		lines = append(lines, "LinkedIn: "+e.LinkedIn)
	}
	if e.Website != "" {
		lines = append(lines, "Website: "+e.Website)
	}
	lines = append(lines, "Subject: "+m.Subject)
	if e.Context != "" {
		lines = append(lines, "", "Context from email:", e.Context)
	}
	lines = append(lines, "", "Review and create/link a contact if this is a real person.")
	return strings.Join(lines, "\n")
}

var phonePattern = regexp.MustCompile(`(?m)(\+?\d[\d\s()./\-]{7,}\d)`)
var linkedinPattern = regexp.MustCompile(`https?://(?:www\.)?linkedin\.com/in/[^\s<>)]+`)
var websitePattern = regexp.MustCompile(`https?://[^\s<>)]+`)

func firstMatch(pattern *regexp.Regexp, s string) string {
	match := pattern.FindString(s)
	return strings.TrimSpace(strings.TrimRight(match, ".,;"))
}

func firstUsefulWebsite(s string) string {
	for _, match := range websitePattern.FindAllString(s, 10) {
		cleaned := strings.TrimSpace(strings.TrimRight(match, ".,;"))
		lower := strings.ToLower(cleaned)
		if strings.Contains(lower, "linkedin.com") || strings.Contains(lower, "calendly.com") || strings.Contains(lower, "youtube.com") || strings.Contains(lower, "youtu.be") {
			continue
		}
		return cleaned
	}
	return ""
}

func likelyTitle(s string) string {
	for _, line := range strings.Split(s, "\n") {
		line = strings.TrimSpace(strings.Trim(line, "|•-–—\t "))
		if len(line) < 4 || len(line) > 100 {
			continue
		}
		lower := strings.ToLower(line)
		if strings.Contains(lower, "founder") || strings.Contains(lower, "partner") || strings.Contains(lower, "ceo") || strings.Contains(lower, "cto") || strings.Contains(lower, "director") || strings.Contains(lower, "head of") || strings.Contains(lower, "consultant") || strings.Contains(lower, "manager") {
			return line
		}
	}
	return ""
}

func cleanEmailText(s string) string {
	lines := []string{}
	for _, line := range strings.Split(s, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, ">") {
			continue
		}
		lower := strings.ToLower(line)
		if strings.Contains(lower, "unsubscribe") || strings.Contains(lower, "view in browser") {
			continue
		}
		lines = append(lines, line)
		if len(strings.Join(lines, "\n")) > 900 {
			break
		}
	}
	return strings.Join(lines, "\n")
}

func emailDomain(email string) string {
	_, domainName, ok := strings.Cut(email, "@")
	if !ok {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(domainName))
}

func isPersonalEmailDomain(domainName string) bool {
	switch domainName {
	case "gmail.com", "googlemail.com", "icloud.com", "me.com", "mac.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "proton.me", "protonmail.com", "gmx.de", "web.de", "t-online.de", "aol.com":
		return true
	default:
		return false
	}
}

func sanitizedEmailActivityBody(m domain.EmailMessage) string {
	if strings.TrimSpace(m.Subject) == "" {
		return "Email"
	}
	return "Subject: " + strings.TrimSpace(m.Subject)
}

func fullEmailActivityBody(m domain.EmailMessage) string {
	body := strings.TrimSpace(m.Subject)
	if m.BodyText != "" {
		if body != "" {
			body += "\n\n"
		}
		body += strings.TrimSpace(m.BodyText)
	}
	return body
}

func relevantEmails(account domain.EmailAccount, m domain.EmailMessage) []string {
	own := strings.ToLower(strings.TrimSpace(account.Email))
	seen := map[string]bool{}
	var out []string
	add := func(email string) {
		email = strings.ToLower(strings.TrimSpace(email))
		if email == "" || email == own || seen[email] {
			return
		}
		seen[email] = true
		out = append(out, email)
	}
	add(m.FromEmail)
	for _, email := range m.ToEmails {
		add(email)
	}
	return out
}

func truncateText(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}

type EmailSyncReport struct {
	Accounts       int      `json:"accounts"`
	NewMessages    int      `json:"new_messages"`
	LinkedMessages int      `json:"linked_messages"`
	Suggestions    int      `json:"suggestions"`
	Errors         []string `json:"errors,omitempty"`
}

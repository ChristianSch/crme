package usecase

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"crme/internal/domain"
	"crme/internal/ports"
)

type AcceptPromptResult struct {
	Result            any       `json:"result"`
	Created           bool      `json:"created"`
	CreatedEntityType string    `json:"created_entity_type,omitempty"`
	CreatedEntityID   domain.ID `json:"created_entity_id,omitempty"`
}

type SuggestionService struct {
	UOW           ports.UnitOfWork
	Prompts       ports.AIPromptStore
	People        ports.PersonStore
	Companies     ports.CompanyStore
	Relationships ports.RelationshipStore
	Activities    ports.ActivityStore
	Emails        ports.EmailMessageStore
}

func (s SuggestionService) withStores(stores ports.Stores) SuggestionService {
	if stores.Prompts != nil {
		s.Prompts = stores.Prompts
	}
	if stores.People != nil {
		s.People = stores.People
	}
	if stores.Companies != nil {
		s.Companies = stores.Companies
	}
	if stores.Relationships != nil {
		s.Relationships = stores.Relationships
	}
	if stores.Activities != nil {
		s.Activities = stores.Activities
	}
	if stores.EmailMessages != nil {
		s.Emails = stores.EmailMessages
	}
	return s
}

func (s SuggestionService) crmService() CRMService {
	return CRMService{People: s.People, Companies: s.Companies, Relationships: s.Relationships, Activities: s.Activities}
}

func (s SuggestionService) emailService() EmailService {
	return EmailService{Messages: s.Emails}
}

func (s SuggestionService) ListPrompts(ctx context.Context, status string, limit, offset int) ([]domain.AIPrompt, error) {
	return s.Prompts.ListAIPrompts(ctx, status, saneLimit(limit), max(offset, 0))
}

func (s SuggestionService) CreatePrompt(ctx context.Context, prompt domain.AIPrompt) (domain.AIPrompt, error) {
	if prompt.Status == "" {
		prompt.Status = "open"
	}
	prompt.Title = strings.TrimSpace(prompt.Title)
	if prompt.Title == "" {
		return prompt, fmt.Errorf("%w: suggestion title is required", ErrValidation)
	}
	return s.Prompts.CreateAIPrompt(ctx, prompt)
}

func (s SuggestionService) ResolvePrompt(ctx context.Context, id domain.ID, status string) (domain.AIPrompt, error) {
	if status != "accepted" && status != "dismissed" && status != "open" {
		return domain.AIPrompt{}, fmt.Errorf("status must be open, accepted, or dismissed")
	}
	return s.Prompts.ResolveAIPrompt(ctx, id, status)
}

func (s SuggestionService) SuppressPrompt(ctx context.Context, id domain.ID) (domain.AIPrompt, error) {
	p, err := s.Prompts.GetAIPrompt(ctx, id)
	if err != nil {
		return domain.AIPrompt{}, err
	}
	targetType, targetIdentifier := suggestionTarget(p)
	if targetType == "" || targetIdentifier == "" {
		return domain.AIPrompt{}, fmt.Errorf("prompt kind %s has no suppression target", p.Kind)
	}
	if err := s.Prompts.SuppressSuggestion(ctx, p.Kind, targetType, targetIdentifier, "never ask again"); err != nil {
		return domain.AIPrompt{}, err
	}
	return s.Prompts.ResolveAIPrompt(ctx, id, "dismissed")
}

func (s SuggestionService) UnsuppressPrompt(ctx context.Context, id domain.ID) (domain.AIPrompt, error) {
	p, err := s.Prompts.GetAIPrompt(ctx, id)
	if err != nil {
		return domain.AIPrompt{}, err
	}
	if targetType, targetIdentifier := suggestionTarget(p); targetType != "" && targetIdentifier != "" {
		if err := s.Prompts.UnsuppressSuggestion(ctx, p.Kind, targetType, targetIdentifier); err != nil {
			return domain.AIPrompt{}, err
		}
	}
	return s.Prompts.ResolveAIPrompt(ctx, id, "open")
}

func (s SuggestionService) AcceptPrompt(ctx context.Context, id domain.ID) (any, error) {
	if s.UOW == nil {
		return s.acceptPrompt(ctx, id)
	}
	var out any
	err := s.UOW.WithinTx(ctx, func(stores ports.Stores) error {
		var err error
		out, err = s.withStores(stores).acceptPrompt(ctx, id)
		return err
	})
	return out, err
}

func (s SuggestionService) acceptPrompt(ctx context.Context, id domain.ID) (any, error) {
	p, err := s.Prompts.GetAIPrompt(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.Status != "open" {
		return nil, fmt.Errorf("prompt is already %s", p.Status)
	}
	switch p.Kind {
	case domain.PromptNewContact:
		email := suggestionValue(p)
		if email == "" || !strings.Contains(email, "@") {
			return nil, fmt.Errorf("cannot infer contact email from suggestion")
		}
		if existing, found, err := s.People.FindPersonByEmail(ctx, email); err != nil {
			return nil, err
		} else if found {
			_, _ = s.Prompts.ResolveAIPrompt(ctx, id, "accepted")
			return AcceptPromptResult{Result: existing, Created: false}, nil
		}
		firstName, lastName := parseSuggestedName(p)
		person := domain.Person{FirstName: firstName, LastName: lastName, Email: strings.ToLower(email), Phone: parsePromptField(p, "Phone"), Title: parsePromptField(p, "Possible title"), LinkedInURL: parsePromptField(p, "LinkedIn"), Source: "email"}
		created, err := s.crmService().CreatePerson(ctx, person)
		if err != nil {
			return nil, err
		}
		if domainName := promptEmailDomain(email); domainName != "" {
			if company, found, err := s.Companies.FindCompanyByDomain(ctx, domainName); err != nil {
				return nil, err
			} else if found {
				_ = s.crmService().LinkPersonCompany(ctx, created.ID, company.ID, "")
			}
		}
		if err := s.linkHistoricalEmails(ctx, domain.EntityPerson, created.ID, email); err != nil {
			return nil, err
		}
		_, err = s.Prompts.ResolveAIPrompt(ctx, id, "accepted")
		return AcceptPromptResult{Result: created, Created: true, CreatedEntityType: "person", CreatedEntityID: created.ID}, err
	case domain.PromptNewCompany:
		domainName := suggestionValue(p)
		if domainName == "" {
			return nil, fmt.Errorf("cannot infer company domain from suggestion")
		}
		if existing, found, err := s.Companies.FindCompanyByDomain(ctx, domainName); err != nil {
			return nil, err
		} else if found {
			_, _ = s.Prompts.ResolveAIPrompt(ctx, id, "accepted")
			return AcceptPromptResult{Result: existing, Created: false}, nil
		}
		name := strings.TrimSuffix(domainName, ".com")
		name = strings.TrimSuffix(name, ".de")
		company := domain.Company{Name: name, Domain: strings.ToLower(domainName)}
		created, err := s.crmService().CreateCompany(ctx, company)
		if err != nil {
			return nil, err
		}
		if err := s.linkHistoricalEmails(ctx, domain.EntityCompany, created.ID, domainName); err != nil {
			return nil, err
		}
		_, err = s.Prompts.ResolveAIPrompt(ctx, id, "accepted")
		return AcceptPromptResult{Result: created, Created: true, CreatedEntityType: "company", CreatedEntityID: created.ID}, err
	default:
		return nil, fmt.Errorf("prompt kind %s cannot be accepted automatically", p.Kind)
	}
}

func (s SuggestionService) LinkSuggestionToPerson(ctx context.Context, id domain.ID, personID domain.ID) (domain.Person, error) {
	if s.UOW == nil {
		return s.linkSuggestionToPerson(ctx, id, personID)
	}
	var out domain.Person
	err := s.UOW.WithinTx(ctx, func(stores ports.Stores) error {
		var err error
		out, err = s.withStores(stores).linkSuggestionToPerson(ctx, id, personID)
		return err
	})
	return out, err
}

func (s SuggestionService) linkSuggestionToPerson(ctx context.Context, id domain.ID, personID domain.ID) (domain.Person, error) {
	p, err := s.Prompts.GetAIPrompt(ctx, id)
	if err != nil {
		return domain.Person{}, err
	}
	if p.Kind != domain.PromptNewContact {
		return domain.Person{}, fmt.Errorf("suggestion is %s, not new_contact", p.Kind)
	}
	email := suggestionValue(p)
	if email == "" || !strings.Contains(email, "@") {
		return domain.Person{}, fmt.Errorf("cannot infer contact email from suggestion")
	}
	person, err := s.People.GetPerson(ctx, personID)
	if err != nil {
		return domain.Person{}, err
	}
	if err := s.crmService().AddPersonEmail(ctx, personID, email, false); err != nil {
		return domain.Person{}, err
	}
	if domainName := promptEmailDomain(email); domainName != "" {
		if company, found, err := s.Companies.FindCompanyByDomain(ctx, domainName); err != nil {
			return domain.Person{}, err
		} else if found {
			_ = s.crmService().LinkPersonCompany(ctx, personID, company.ID, "")
		}
	}
	if err := s.linkHistoricalEmails(ctx, domain.EntityPerson, personID, email); err != nil {
		return domain.Person{}, err
	}
	_, err = s.Prompts.ResolveAIPrompt(ctx, id, "accepted")
	return person, err
}

func (s SuggestionService) LinkSuggestionToCompany(ctx context.Context, id domain.ID, companyID domain.ID) (domain.Company, error) {
	if s.UOW == nil {
		return s.linkSuggestionToCompany(ctx, id, companyID)
	}
	var out domain.Company
	err := s.UOW.WithinTx(ctx, func(stores ports.Stores) error {
		var err error
		out, err = s.withStores(stores).linkSuggestionToCompany(ctx, id, companyID)
		return err
	})
	return out, err
}

func (s SuggestionService) linkSuggestionToCompany(ctx context.Context, id domain.ID, companyID domain.ID) (domain.Company, error) {
	p, err := s.Prompts.GetAIPrompt(ctx, id)
	if err != nil {
		return domain.Company{}, err
	}
	if p.Kind != domain.PromptNewCompany {
		return domain.Company{}, fmt.Errorf("suggestion is %s, not new_company", p.Kind)
	}
	domainName := suggestionValue(p)
	if domainName == "" {
		return domain.Company{}, fmt.Errorf("cannot infer company domain from suggestion")
	}
	company, err := s.Companies.GetCompany(ctx, companyID)
	if err != nil {
		return domain.Company{}, err
	}
	if err := s.crmService().AddCompanyDomain(ctx, companyID, domainName, false); err != nil {
		return domain.Company{}, err
	}
	if err := s.linkHistoricalEmails(ctx, domain.EntityCompany, companyID, domainName); err != nil {
		return domain.Company{}, err
	}
	_, err = s.Prompts.ResolveAIPrompt(ctx, id, "accepted")
	return company, err
}

func (s SuggestionService) linkHistoricalEmails(ctx context.Context, entityType domain.EntityType, entityID domain.ID, value string) error {
	var messages []domain.EmailMessage
	var err error
	if entityType == domain.EntityPerson {
		messages, err = s.Emails.ListEmailMessagesForAddress(ctx, value, 200)
	} else if entityType == domain.EntityCompany {
		messages, err = s.Emails.ListEmailMessagesForDomain(ctx, value, 200)
	}
	if err != nil {
		return err
	}
	for _, m := range messages {
		if m.ActivityID != "" {
			if err := s.crmService().LinkActivity(ctx, m.ActivityID, entityType, entityID); err != nil {
				return err
			}
		} else {
			body := strings.TrimSpace(m.Subject)
			if m.BodyText != "" {
				if body != "" {
					body += "\n\n"
				}
				body += truncatePromptText(strings.TrimSpace(m.BodyText), 2000)
			}
			activity, err := s.crmService().CreateActivity(ctx, domain.Activity{Type: domain.ActivityEmail, Body: body, OccurredAt: m.SentAt}, []domain.ActivityLink{{EntityType: entityType, EntityID: entityID}})
			if err != nil {
				return err
			}
			if err := s.emailService().SetMessageActivity(ctx, m.MessageID, activity.ID); err != nil {
				return err
			}
		}
		if entityType == domain.EntityPerson {
			if err := s.crmService().TouchPerson(ctx, entityID, m.SentAt); err != nil {
				return err
			}
		} else if entityType == domain.EntityCompany {
			if err := s.crmService().TouchCompany(ctx, entityID, m.SentAt); err != nil {
				return err
			}
		}
	}
	return nil
}

func suggestionTarget(p domain.AIPrompt) (string, string) {
	targetType := strings.ToLower(strings.TrimSpace(p.TargetType))
	targetIdentifier := strings.ToLower(strings.TrimSpace(p.TargetIdentifier))
	if targetType != "" && targetIdentifier != "" {
		return targetType, targetIdentifier
	}

	// Legacy fallback for prompts created before structured targets existed.
	switch p.Kind {
	case domain.PromptNewContact:
		return "email", extractEmail(strings.TrimPrefix(p.Title, "New contact:") + "\n" + p.Body)
	case domain.PromptNewCompany:
		return "domain", strings.ToLower(strings.TrimSpace(strings.TrimPrefix(p.Title, "New company:")))
	default:
		return "", ""
	}
}

func suggestionValue(p domain.AIPrompt) string {
	_, targetIdentifier := suggestionTarget(p)
	return targetIdentifier
}

var emailPattern = regexp.MustCompile(`(?i)[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}`)

func extractEmail(s string) string {
	match := emailPattern.FindString(s)
	return strings.ToLower(strings.TrimSpace(match))
}

func parseSuggestedName(p domain.AIPrompt) (string, string) {
	name := parsePromptField(p, "Name")
	parts := strings.Fields(strings.TrimSpace(name))
	if len(parts) == 0 {
		return "", ""
	}
	if len(parts) == 1 {
		return parts[0], ""
	}
	return parts[0], strings.Join(parts[1:], " ")
}

func parsePromptField(p domain.AIPrompt, label string) string {
	prefix := strings.ToLower(label) + ":"
	for _, line := range strings.Split(p.Body, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(strings.ToLower(line), prefix) {
			return strings.TrimSpace(line[len(prefix):])
		}
	}
	return ""
}

func promptEmailDomain(email string) string {
	_, domainName, ok := strings.Cut(email, "@")
	if !ok {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(domainName))
}

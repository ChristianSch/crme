package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"crme/internal/domain"
	"crme/internal/ports"
)

type emailMessageStoreFake struct{}

func (emailMessageStoreFake) UpsertEmailMessage(ctx context.Context, m domain.EmailMessage) (bool, error) {
	return true, nil
}
func (emailMessageStoreFake) SetEmailMessageActivity(ctx context.Context, messageID string, activityID domain.ID) error {
	return nil
}
func (emailMessageStoreFake) ListEmailMessagesForAddress(ctx context.Context, email string, limit int) ([]domain.EmailMessage, error) {
	return nil, nil
}
func (emailMessageStoreFake) ListEmailMessagesForDomain(ctx context.Context, domain string, limit int) ([]domain.EmailMessage, error) {
	return nil, nil
}

type emailPersonStoreFake struct{}

func (emailPersonStoreFake) CreatePerson(ctx context.Context, p domain.Person) (domain.Person, error) {
	return p, nil
}
func (emailPersonStoreFake) GetPerson(ctx context.Context, id domain.ID) (domain.Person, error) {
	return domain.Person{}, nil
}
func (emailPersonStoreFake) UpdatePerson(ctx context.Context, p domain.Person) (domain.Person, error) {
	return p, nil
}
func (emailPersonStoreFake) DeletePerson(ctx context.Context, id domain.ID) error { return nil }
func (emailPersonStoreFake) ListPeople(ctx context.Context, query string, workspaceID domain.ID, limit, offset int) ([]domain.Person, error) {
	return nil, nil
}
func (emailPersonStoreFake) FindPersonByEmail(ctx context.Context, email string) (domain.Person, bool, error) {
	return domain.Person{ID: "person-1"}, true, nil
}
func (emailPersonStoreFake) AddPersonEmail(ctx context.Context, personID domain.ID, email string, primary bool) error {
	return nil
}
func (emailPersonStoreFake) TouchPerson(ctx context.Context, id domain.ID, at time.Time) error {
	return nil
}

type emailUOWFake struct {
	activityErr error
	committed   bool
}

func (u *emailUOWFake) WithinTx(ctx context.Context, fn func(stores ports.Stores) error) error {
	err := fn(ports.Stores{EmailMessages: emailMessageStoreFake{}, People: emailPersonStoreFake{}, Companies: aiCompanyStoreFake{}, Activities: aiActivityStoreFake{createErr: u.activityErr}, Prompts: aiPromptStoreFake{}})
	if err == nil {
		u.committed = true
	}
	return err
}

func TestProcessFetchedMessageRollbackOnTimelineFailure(t *testing.T) {
	boom := errors.New("activity failed")
	uow := &emailUOWFake{activityErr: boom}
	svc := EmailService{UOW: uow}
	_, _, _, err := svc.processFetchedMessage(context.Background(), domain.EmailAccount{Email: "me@example.com"}, domain.EmailMessage{MessageID: "m1", FromEmail: "ada@example.com", SentAt: time.Now()})
	if !errors.Is(err, boom) {
		t.Fatalf("expected activity error, got %v", err)
	}
	if uow.committed {
		t.Fatal("expected transaction not to commit")
	}
}

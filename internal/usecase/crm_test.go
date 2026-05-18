package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"crme/internal/domain"
	"crme/internal/ports"
)

type crmPersonStoreFake struct {
	created int
}

func (f *crmPersonStoreFake) CreatePerson(ctx context.Context, p domain.Person) (domain.Person, error) {
	f.created++
	p.ID = "person-1"
	return p, nil
}
func (f *crmPersonStoreFake) GetPerson(ctx context.Context, id domain.ID) (domain.Person, error) {
	return domain.Person{}, nil
}
func (f *crmPersonStoreFake) UpdatePerson(ctx context.Context, p domain.Person) (domain.Person, error) {
	return p, nil
}
func (f *crmPersonStoreFake) DeletePerson(ctx context.Context, id domain.ID) error { return nil }
func (f *crmPersonStoreFake) ListPeople(ctx context.Context, query string, workspaceID domain.ID, limit, offset int) ([]domain.Person, error) {
	return nil, nil
}
func (f *crmPersonStoreFake) FindPersonByEmail(ctx context.Context, email string) (domain.Person, bool, error) {
	return domain.Person{}, false, nil
}
func (f *crmPersonStoreFake) AddPersonEmail(ctx context.Context, personID domain.ID, email string, primary bool) error {
	return nil
}
func (f *crmPersonStoreFake) TouchPerson(ctx context.Context, id domain.ID, at time.Time) error {
	return nil
}

type crmWorkspaceStoreFake struct{ linkErr error }

func (f crmWorkspaceStoreFake) CreateWorkspace(ctx context.Context, workspace domain.Workspace) (domain.Workspace, error) {
	return workspace, nil
}
func (f crmWorkspaceStoreFake) ListWorkspaces(ctx context.Context, limit int) ([]domain.Workspace, error) {
	return nil, nil
}
func (f crmWorkspaceStoreFake) LinkWorkspaceEntity(ctx context.Context, workspaceID domain.ID, entityType domain.EntityType, entityID domain.ID) error {
	return f.linkErr
}
func (f crmWorkspaceStoreFake) ListWorkspaceEntities(ctx context.Context, workspaceID domain.ID, entityType domain.EntityType, limit int) ([]domain.WorkspaceEntity, error) {
	return nil, nil
}

type rollbackUOWFake struct {
	people    *crmPersonStoreFake
	workspace crmWorkspaceStoreFake
	committed bool
}

func (u *rollbackUOWFake) WithinTx(ctx context.Context, fn func(stores ports.Stores) error) error {
	err := fn(ports.Stores{People: u.people, Workspaces: u.workspace})
	if err == nil {
		u.committed = true
	}
	return err
}

func TestCRMValidation(t *testing.T) {
	svc := CRMService{}
	if _, err := svc.CreatePerson(context.Background(), domain.Person{}); !errors.Is(err, ErrValidation) {
		t.Fatalf("expected person validation error, got %v", err)
	}
	if _, err := svc.CreateCompany(context.Background(), domain.Company{}); !errors.Is(err, ErrValidation) {
		t.Fatalf("expected company validation error, got %v", err)
	}
	if _, err := svc.CreateDeal(context.Background(), domain.Deal{}); !errors.Is(err, ErrValidation) {
		t.Fatalf("expected deal validation error, got %v", err)
	}
	if _, err := svc.CreateTodo(context.Background(), domain.Todo{}); !errors.Is(err, ErrValidation) {
		t.Fatalf("expected task validation error, got %v", err)
	}
	if _, err := svc.CreateWorkspace(context.Background(), domain.Workspace{}); !errors.Is(err, ErrValidation) {
		t.Fatalf("expected workspace validation error, got %v", err)
	}
	if _, err := svc.CreateActivity(context.Background(), domain.Activity{Type: "bad"}, nil); !errors.Is(err, ErrValidation) {
		t.Fatalf("expected activity validation error, got %v", err)
	}
}

func TestCreatePersonInWorkspaceReturnsLinkErrorAndDoesNotCommit(t *testing.T) {
	linkErr := errors.New("link failed")
	uow := &rollbackUOWFake{people: &crmPersonStoreFake{}, workspace: crmWorkspaceStoreFake{linkErr: linkErr}}
	svc := CRMService{UOW: uow}

	_, err := svc.CreatePersonInWorkspace(context.Background(), domain.Person{FirstName: "Ada", Email: "A@Example.COM"}, "workspace-1")
	if !errors.Is(err, linkErr) {
		t.Fatalf("expected link error, got %v", err)
	}
	if uow.committed {
		t.Fatal("expected transaction not to commit")
	}
	if uow.people.created != 1 {
		t.Fatalf("expected create attempted once, got %d", uow.people.created)
	}
}

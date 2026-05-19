package postgres

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"crme/internal/authctx"
	"crme/internal/domain"
)

func TestRLSOrganizationIsolationAndPrivateEmail(t *testing.T) {
	if os.Getenv("CRME_POSTGRES_RLS_TEST") != "1" {
		t.Skip("set CRME_POSTGRES_RLS_TEST=1 to run Postgres RLS integration tests")
	}
	ctx := context.Background()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres:postgres@localhost:5432/crme?sslmode=disable"
	}

	adminPool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer adminPool.Close()

	roleName := fmt.Sprintf("crme_rls_test_%d", time.Now().UnixNano())
	roleIdent := quoteIdent(roleName)
	for _, stmt := range []string{
		"create role " + roleIdent,
		"grant usage on schema public to " + roleIdent,
		"grant select, insert, update, delete on all tables in schema public to " + roleIdent,
	} {
		if _, err := adminPool.Exec(ctx, stmt); err != nil {
			t.Fatalf("%s: %v", stmt, err)
		}
	}
	defer func() {
		_, _ = adminPool.Exec(context.Background(), "drop role if exists "+roleIdent)
	}()

	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "set role "+roleIdent)
		return err
	}
	appPool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	store := &Store{pool: appPool}
	defer store.Close()

	prefix := fmt.Sprintf("rls-%d", time.Now().UnixNano())
	authCtx := authctx.WithAuthAccess(ctx)
	owner1, err := store.CreateUser(authCtx, prefix+"-owner1@example.test", "user", true)
	if err != nil {
		t.Fatal(err)
	}
	owner2, err := store.CreateUser(authCtx, prefix+"-owner2@example.test", "user", true)
	if err != nil {
		t.Fatal(err)
	}
	adminUser, err := store.CreateUser(authCtx, prefix+"-admin@example.test", "user", true)
	if err != nil {
		t.Fatal(err)
	}
	memberUser, err := store.CreateUser(authCtx, prefix+"-member@example.test", "user", true)
	if err != nil {
		t.Fatal(err)
	}
	viewerUser, err := store.CreateUser(authCtx, prefix+"-viewer@example.test", "user", true)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok, err := store.ActiveUserByEmail(ctx, prefix+"-owner1@example.test"); err != nil || ok {
		t.Fatalf("unauthenticated user lookup should be hidden by RLS, ok=%v err=%v", ok, err)
	}
	if _, ok, err := store.ActiveUserByEmail(authCtx, prefix+"-owner1@example.test"); err != nil || !ok {
		t.Fatalf("authenticator user lookup ok=%v err=%v", ok, err)
	}
	if err := store.CreateMagicLink(ctx, prefix+"-blocked@example.test", "blocked-token", time.Now().Add(time.Hour)); err == nil {
		t.Fatal("unauthenticated magic link insert unexpectedly succeeded")
	}
	org1, err := store.CreateOrganizationWithOwner(authctx.WithAccess(ctx, authctx.Access{UserID: owner1, Role: "org_creator"}), prefix+" org 1", owner1)
	if err != nil {
		t.Fatal(err)
	}
	org2, err := store.CreateOrganizationWithOwner(authctx.WithAccess(ctx, authctx.Access{UserID: owner2, Role: "org_creator"}), prefix+" org 2", owner2)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := adminPool.Exec(ctx, `insert into organization_members (organization_id,user_id,role) values ($1,$2,'admin'), ($1,$3,'member'), ($1,$4,'viewer')`, org1.ID, adminUser, memberUser, viewerUser); err != nil {
		t.Fatal(err)
	}
	defer func() {
		_, _ = adminPool.Exec(context.Background(), `delete from organizations where id = any($1)`, []domain.ID{org1.ID, org2.ID})
		_, _ = adminPool.Exec(context.Background(), `delete from users where id = any($1)`, []domain.ID{owner1, owner2, adminUser, memberUser, viewerUser})
	}()

	owner1Ctx := access(ctx, owner1, org1.ID, "owner")
	owner2Ctx := access(ctx, owner2, org2.ID, "owner")
	adminCtx := access(ctx, adminUser, org1.ID, "admin")
	memberCtx := access(ctx, memberUser, org1.ID, "member")
	viewerCtx := access(ctx, viewerUser, org1.ID, "viewer")

	person, err := store.CreatePerson(owner1Ctx, domain.Person{FirstName: "RLS", LastName: "Person", Email: prefix + "@example.test"})
	if err != nil {
		t.Fatalf("owner create person: %v", err)
	}
	people, err := store.ListPeople(owner2Ctx, "", "", 50, 0)
	if err != nil {
		t.Fatalf("other org list people: %v", err)
	}
	for _, p := range people {
		if p.ID == person.ID {
			t.Fatalf("cross-org list leaked person %s", person.ID)
		}
	}
	if _, err := store.GetPerson(owner2Ctx, person.ID); err == nil {
		t.Fatal("cross-org get unexpectedly returned person")
	}
	if _, err := store.CreatePerson(viewerCtx, domain.Person{FirstName: "Viewer"}); err == nil {
		t.Fatal("viewer create person unexpectedly succeeded")
	}
	if _, err := store.CreatePerson(memberCtx, domain.Person{FirstName: "Member", Email: prefix + "+member@example.test"}); err != nil {
		t.Fatalf("member create person: %v", err)
	}
	aliasEmail := prefix + "+alias@example.test"
	if err := store.AddPersonEmail(owner1Ctx, person.ID, aliasEmail, false); err != nil {
		t.Fatalf("add person alias email: %v", err)
	}
	if _, found, err := store.FindPersonByEmail(owner1Ctx, aliasEmail); err != nil || !found {
		t.Fatalf("owner alias lookup found=%v err=%v", found, err)
	}
	if _, found, err := store.FindPersonByEmail(owner2Ctx, aliasEmail); err != nil || found {
		t.Fatalf("other org alias lookup found=%v err=%v", found, err)
	}

	company, err := store.CreateCompany(owner1Ctx, domain.Company{Name: prefix + " Company", Domain: prefix + ".example"})
	if err != nil {
		t.Fatalf("owner create company: %v", err)
	}
	aliasDomain := "alias-" + prefix + ".example"
	if err := store.AddCompanyDomain(owner1Ctx, company.ID, aliasDomain, false); err != nil {
		t.Fatalf("add company alias domain: %v", err)
	}
	if _, found, err := store.FindCompanyByDomain(owner1Ctx, aliasDomain); err != nil || !found {
		t.Fatalf("owner domain lookup found=%v err=%v", found, err)
	}
	if _, found, err := store.FindCompanyByDomain(owner2Ctx, aliasDomain); err != nil || found {
		t.Fatalf("other org domain lookup found=%v err=%v", found, err)
	}

	otherCompany, err := store.CreateCompany(owner2Ctx, domain.Company{Name: prefix + " Other Company", Domain: "other-" + prefix + ".example"})
	if err != nil {
		t.Fatalf("other org create company: %v", err)
	}
	if err := store.LinkPersonCompany(owner1Ctx, person.ID, otherCompany.ID, "bad"); err == nil {
		t.Fatal("cross-org person-company link unexpectedly succeeded")
	}
	otherWorkspace, err := store.CreateWorkspace(owner2Ctx, domain.Workspace{Name: prefix + " Other Workspace"})
	if err != nil {
		t.Fatalf("other org create workspace: %v", err)
	}
	if err := store.LinkWorkspaceEntity(owner1Ctx, otherWorkspace.ID, domain.EntityPerson, person.ID); err == nil {
		t.Fatal("cross-org workspace-person link unexpectedly succeeded")
	}
	members, err := store.ListOrganizationMembers(owner2Ctx, org1.ID)
	if err != nil {
		t.Fatalf("other org list organization members: %v", err)
	}
	if len(members) != 0 {
		t.Fatalf("other org saw organization members: %#v", members)
	}

	prompt, err := store.CreateAIPrompt(owner1Ctx, domain.AIPrompt{Kind: domain.PromptNewContact, EntityType: domain.EntityPerson, EntityID: person.ID, Title: prefix + " prompt", Body: "body", Status: "open"})
	if err != nil {
		t.Fatalf("create ai prompt: %v", err)
	}
	prompts, err := store.ListAIPrompts(owner2Ctx, "open", 50, 0)
	if err != nil {
		t.Fatalf("other org list prompts: %v", err)
	}
	for _, p := range prompts {
		if p.ID == prompt.ID {
			t.Fatalf("cross-org list leaked prompt %s", prompt.ID)
		}
	}
	if err := store.SuppressSuggestion(owner1Ctx, domain.PromptNewContact, "email", prefix+"@lead.test", "test"); err != nil {
		t.Fatalf("suppress suggestion: %v", err)
	}
	if suppressed, err := store.IsSuggestionSuppressed(owner1Ctx, domain.PromptNewContact, "email", prefix+"@lead.test"); err != nil || !suppressed {
		t.Fatalf("owner suppression = %v, %v", suppressed, err)
	}
	if suppressed, err := store.IsSuggestionSuppressed(owner2Ctx, domain.PromptNewContact, "email", prefix+"@lead.test"); err != nil || suppressed {
		t.Fatalf("other org suppression = %v, %v", suppressed, err)
	}

	_, err = store.CreateAuditLog(memberCtx, domain.AuditLog{Action: "test.member_action", TargetType: "person", TargetID: person.ID, Details: map[string]any{"ok": true}})
	if err != nil {
		t.Fatalf("member create audit log: %v", err)
	}
	adminAuditLogs, err := store.ListAuditLogs(adminCtx, org1.ID, 10, 0)
	if err != nil {
		t.Fatalf("admin list audit logs: %v", err)
	}
	foundAuditLog := false
	for _, log := range adminAuditLogs {
		foundAuditLog = foundAuditLog || log.Action == "test.member_action"
	}
	if !foundAuditLog {
		t.Fatalf("admin audit logs did not include test.member_action: %#v", adminAuditLogs)
	}
	memberAuditLogs, err := store.ListAuditLogs(memberCtx, org1.ID, 10, 0)
	if err != nil {
		t.Fatalf("member list audit logs should be hidden by RLS as empty result, not error: %v", err)
	}
	if len(memberAuditLogs) != 0 {
		t.Fatalf("member saw audit logs: %#v", memberAuditLogs)
	}
	otherOrgAuditLogs, err := store.ListAuditLogs(owner2Ctx, org1.ID, 10, 0)
	if err != nil {
		t.Fatalf("other org list audit logs should be hidden by RLS as empty result, not error: %v", err)
	}
	if len(otherOrgAuditLogs) != 0 {
		t.Fatalf("other org saw audit logs: %#v", otherOrgAuditLogs)
	}

	secretID, err := store.CreateRuntimeSecret(owner1Ctx, "email_account", "password", []byte("ciphertext"), []byte("nonce"))
	if err != nil {
		t.Fatalf("owner create runtime secret: %v", err)
	}
	if _, _, _, _, err := store.GetRuntimeSecret(owner1Ctx, secretID); err != nil {
		t.Fatalf("owner get runtime secret: %v", err)
	}
	if _, _, _, _, err := store.GetRuntimeSecret(adminCtx, secretID); err == nil {
		t.Fatal("admin resolved another user's runtime secret")
	}
	if _, _, _, _, err := store.GetRuntimeSecret(owner2Ctx, secretID); err == nil {
		t.Fatal("other org resolved runtime secret")
	}
	if _, _, _, _, err := store.GetRuntimeSecret(authctx.WithSystemAccess(ctx), secretID); err != nil {
		t.Fatalf("system get runtime secret: %v", err)
	}

	account, err := store.CreateEmailAccount(owner1Ctx, domain.EmailAccount{Name: "Owner Mail", Email: prefix + "@mail.test", IMAPHost: "imap.test", IMAPPort: 993, SecretRef: "secret", SyncEnabled: true})
	if err != nil {
		t.Fatalf("owner create email account: %v", err)
	}
	ownerAccounts, err := store.ListEmailAccounts(owner1Ctx, 10)
	if err != nil || len(ownerAccounts) != 1 || ownerAccounts[0].ID != account.ID {
		t.Fatalf("owner account visibility = %#v, %v", ownerAccounts, err)
	}
	adminAccounts, err := store.ListEmailAccounts(adminCtx, 10)
	if err != nil {
		t.Fatalf("admin list email accounts: %v", err)
	}
	if len(adminAccounts) != 0 {
		t.Fatalf("admin saw private email accounts: %#v", adminAccounts)
	}
	syncAccounts, err := store.ListSyncEnabledEmailAccounts(authctx.WithSystemAccess(ctx), 100)
	if err != nil {
		t.Fatalf("system list sync accounts: %v", err)
	}
	foundSyncAccount := false
	for _, a := range syncAccounts {
		foundSyncAccount = foundSyncAccount || a.ID == account.ID
	}
	if !foundSyncAccount {
		t.Fatalf("system account enumeration did not include %s", account.ID)
	}

	inserted, err := store.UpsertEmailMessage(owner1Ctx, domain.EmailMessage{EmailAccountID: account.ID, MessageID: prefix + "-msg", ThreadKey: prefix + "-thread", Direction: "inbound", FromEmail: "client@example.test", ToEmails: []string{account.Email}, Subject: "private", BodyText: "private body", SentAt: time.Now()})
	if err != nil || !inserted {
		t.Fatalf("upsert email message inserted=%v err=%v", inserted, err)
	}
	adminMessages, err := store.ListEmailMessagesForAddress(adminCtx, "client@example.test", 10)
	if err != nil {
		t.Fatalf("admin list messages: %v", err)
	}
	if len(adminMessages) != 0 {
		t.Fatalf("admin saw private email messages: %#v", adminMessages)
	}

	activity, err := store.CreateActivity(owner1Ctx, domain.Activity{Type: "email", Body: "Email with client", OccurredAt: time.Now()}, []domain.ActivityLink{{EntityType: domain.EntityPerson, EntityID: person.ID}})
	if err != nil {
		t.Fatalf("create activity: %v", err)
	}
	if err := store.CreateActivityDetail(owner1Ctx, domain.ActivityDetail{ActivityID: activity.ID, OwnerUserID: owner1, BodyText: "private full email"}); err != nil {
		t.Fatalf("create activity detail: %v", err)
	}
	ownerTimeline, err := store.ListTimeline(owner1Ctx, domain.EntityPerson, person.ID, 10)
	if err != nil || len(ownerTimeline) == 0 || ownerTimeline[0].PrivateBody != "private full email" || !ownerTimeline[0].PrivateDetailOwn {
		t.Fatalf("owner timeline = %#v, %v", ownerTimeline, err)
	}
	adminTimeline, err := store.ListTimeline(adminCtx, domain.EntityPerson, person.ID, 10)
	if err != nil || len(adminTimeline) == 0 || adminTimeline[0].PrivateBody != "" || adminTimeline[0].PrivateDetailOwn {
		t.Fatalf("admin timeline = %#v, %v", adminTimeline, err)
	}
}

func access(ctx context.Context, userID, orgID domain.ID, role string) context.Context {
	return authctx.WithAccess(ctx, authctx.Access{UserID: userID, OrganizationID: orgID, Role: role})
}

func quoteIdent(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}

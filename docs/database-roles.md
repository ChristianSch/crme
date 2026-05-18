# Database roles and RLS

CRME uses PostgreSQL row-level security as a backstop for organization isolation and private email data. In production, the API must not connect as the database owner or a superuser, because those roles can bypass RLS.

Use two roles:

- a migration/owner role that owns tables and runs `tern migrate`
- an app role used by `DATABASE_URL` at runtime

Example setup:

```sql
-- Run as a PostgreSQL admin. Pick strong passwords in real deployments.
create role crme_owner login password 'change-me-owner';
create role crme_app login password 'change-me-app';

grant connect on database crme to crme_owner, crme_app;
grant usage, create on schema public to crme_owner;
grant usage on schema public to crme_app;

-- After migrations have created tables:
grant select, insert, update, delete on all tables in schema public to crme_app;
grant usage, select, update on all sequences in schema public to crme_app;

-- Keep future tables usable by the runtime role when migrations are run as crme_owner.
alter default privileges for role crme_owner in schema public
  grant select, insert, update, delete on tables to crme_app;
alter default privileges for role crme_owner in schema public
  grant usage, select, update on sequences to crme_app;
```

Run migrations with the owner role, then run the API with the app role:

```bash
DATABASE_URL='postgres://crme_owner:...@host:5432/crme?sslmode=require' \
  tern migrate --config tern.conf --migrations migrations

DATABASE_URL='postgres://crme_app:...@host:5432/crme?sslmode=require' \
  go run ./cmd/server
```

The app role should not have `BYPASSRLS`, should not own CRME tables, and should not be a superuser. Core tenant tables use `FORCE ROW LEVEL SECURITY`, and the Postgres adapter sets these transaction-local settings for every authenticated request:

- `app.user_id`
- `app.organization_id`
- `app.role`

Background email sync enumerates sync-enabled accounts with `app.role = 'system'`, then processes each mailbox under that mailbox owner's user/org context.

## Verifying RLS locally

The normal Go test suite skips database integration tests. To verify RLS against local Postgres:

```bash
tern migrate --config tern.conf --migrations migrations
CRME_POSTGRES_RLS_TEST=1 go test ./internal/adapters/postgres -run TestRLSOrganizationIsolationAndPrivateEmail -count=1 -v
```

That test creates a temporary non-owner database role and verifies cross-org isolation, viewer write denial, org-scoped suggestions, owner/admin-only audit logs, owner-only email/message visibility, owner-only runtime secrets, owner-only activity details, and system email-account enumeration.

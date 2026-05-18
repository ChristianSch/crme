# Pre-production plan

This plan captures what should be true before running CRME for real users or private business data.

## Current status

The application builds and the main local test suites pass, but production readiness depends more on deployment, database roles, secrets, backups, and operational runbooks than on code compilation.

Recent local checks passed:

- `go test ./...`
- `cd frontend && bun run lint && bun run build`
- `cd extension && npm run compile && npm run build`

## Goals

- Protect tenant data and mailbox/private activity data.
- Make RLS effective in the deployed database.
- Make deployment repeatable and recoverable.
- Avoid dev-only auth, secrets, and origin defaults.
- Have enough observability to debug incidents without exposing private content.

## 0. Production launch blockers

Do not run production traffic until these are complete.

- [ ] Deploy API and frontend behind HTTPS.
- [ ] Run the API with `APP_ENV=prod`.
- [ ] Set a strong unique `MAGIC_LINK_SECRET`; never use `dev-secret-change-me`.
- [ ] Set `CRME_SECRET_KEY` to 32 random bytes, base64 encoded, before creating email accounts.
- [ ] Configure real magic-link delivery with `RESEND_API_KEY` and `RESEND_DOMAIN`.
- [ ] Restrict `CRME_ALLOWED_ORIGINS` to trusted frontend and extension origins.
- [ ] Use a non-owner, non-superuser Postgres runtime role for `DATABASE_URL`.
- [ ] Run migrations with a separate owner/migration role.
- [ ] Verify RLS against the deployed role setup.
- [ ] Have a tested database backup and restore procedure.

## 1. Deployment packaging

Current `docker-compose.yml` only starts local Postgres. Production needs a real deployment shape.

- [ ] Decide the production target: single VM, container host, PaaS, Kubernetes, or managed app platform.
- [ ] Add Dockerfiles or deployment scripts for:
  - Go API server
  - Next.js frontend
  - migration runner using `tern`
- [ ] Document start commands and required environment variables for each process.
- [ ] Ensure the API and frontend have health checks in the deployment platform.
- [ ] Ensure deploys do not require local files such as `.env`, `data/`, or `backups/`.
- [ ] Decide whether the browser extension is loaded manually, distributed privately, or published through a store.

## 2. Database, migrations, and RLS

- [ ] Provision production Postgres with SSL required.
- [ ] Create two roles as documented in `docs/database-roles.md`:
  - migration/owner role that owns tables and runs migrations
  - runtime app role that does not own tables, is not superuser, and does not have `BYPASSRLS`
- [ ] Run `tern migrate --config tern.conf --migrations migrations` with the migration/owner role.
- [ ] Grant table and sequence privileges to the app role after migrations.
- [ ] Configure the API `DATABASE_URL` to use the app role only.
- [ ] Run the RLS integration test against a representative Postgres setup:

```bash
CRME_POSTGRES_RLS_TEST=1 go test ./internal/adapters/postgres -run TestRLSOrganizationIsolationAndPrivateEmail -count=1 -v
```

- [ ] Verify cross-org isolation manually in the UI/API before launch.
- [ ] Document the migration procedure for future deploys, including rollback expectations.

## 3. Secrets and configuration

Required production environment:

- [ ] `APP_ENV=prod`
- [ ] `DATABASE_URL=postgres://...?...sslmode=require` using the app role
- [ ] `APP_BASE_URL=https://...`
- [ ] `FRONTEND_BASE_URL=https://...`
- [ ] `CRME_ALLOWED_ORIGINS=...` restricted to trusted origins
- [ ] `MAGIC_LINK_SECRET=...` strong random value
- [ ] `CRME_SECRET_KEY=...` 32 random bytes, base64 encoded
- [ ] `RESEND_API_KEY=...`
- [ ] `RESEND_DOMAIN=...`
- [ ] `LOG_LEVEL=info` or stricter unless debugging
- [ ] `LOG_FORMAT=json` if logs are collected centrally

Optional production environment:

- [ ] `OPENROUTER_API_KEY` only if external AI processing is acceptable.
- [ ] `OPENROUTER_MODEL` pinned to the intended model.
- [ ] `EMAIL_SYNC_INTERVAL` only after mailbox sync behavior is verified.
- [ ] `HOUSEKEEPING_INTERVAL` enabled for session/magic-link cleanup.

## 4. Authentication, cookies, and origins

- [ ] Confirm magic-link emails are delivered and links use the production base URL.
- [ ] Confirm session cookies are secure in `APP_ENV=prod`.
- [ ] Confirm logout revokes the current session.
- [ ] Confirm the first-login bootstrap flow is acceptable for the deployment.
- [ ] Remove or rotate `BOOTSTRAP_OWNER_EMAIL` after the initial owner is created if it is no longer needed operationally.
- [ ] Confirm CORS/origin checks allow only the production frontend and intended extension origins.
- [ ] Confirm dev log magic-link behavior is unavailable in production.

## 5. Email and private data

- [ ] Verify add, test, update, disable, and remove mailbox flows end-to-end.
- [ ] Verify `CRME_SECRET_KEY` is configured before any mailbox credentials are stored.
- [ ] Verify private mailbox data, raw messages, runtime secrets, and full activity details are owner-only.
- [ ] Verify organization timelines expose only sanitized email activity envelopes to teammates.
- [ ] Decide and document whether email sync is manual or scheduled at launch.
- [ ] If multiple API instances run, add Postgres advisory locks around background jobs before enabling scheduled sync.

## 6. Backups and recovery

- [ ] Enable automated database backups.
- [ ] Document backup retention policy.
- [ ] Test restoring a backup into a separate database.
- [ ] Document where backups are stored and who can access them.
- [ ] Treat backups, CSV imports, mailbox contents, and `.env` files as private data.
- [ ] Document a recovery procedure for accidental owner lockout or lost deployment secrets.

## 7. Observability and operations

- [ ] Use structured logs in production, preferably `LOG_FORMAT=json`.
- [ ] Include request IDs in access logs.
- [ ] Propagate request IDs through context so downstream auth/usecase logs share the same id.
- [ ] Add uptime/health monitoring for API, frontend, and database connectivity.
- [ ] Add error monitoring or alerting for 5xx responses, failed migrations, and failed email sync jobs.
- [ ] Document routine operational commands:
  - run migrations
  - create/verify owner login
  - inspect health
  - rotate secrets
  - restore backup

## 8. Security validation

- [ ] Run all local checks before deploy:
  - `go test ./...`
  - `cd frontend && bun run lint && bun run build`
  - `cd extension && npm run compile && npm run build`
- [ ] Run RLS integration tests against a representative database role setup.
- [ ] Verify viewer write denial, member team-management denial, cross-org isolation, and owner-only private details.
- [ ] Verify `APP_ENV=prod` rejects unsafe defaults.
- [ ] Verify no sensitive values are emitted in logs.
- [ ] Review browser extension host permissions for the deployment model.

## 9. Product readiness checks

- [ ] Verify organization creation, invitation, acceptance, member role change, and member removal flows.
- [ ] Verify last-owner protection and decide whether ownership transfer/additional-owner promotion is required before launch.
- [ ] Verify core CRM CRUD for people, companies, deals, tasks, relationships, activities, and tags.
- [ ] Verify mobile or small-screen behavior for the expected users.
- [ ] Verify destructive actions have acceptable confirmation/undo behavior.
- [ ] Verify assistant and suggestion flows are safe enough for the intended users, especially mutating actions.

## Suggested order

1. Choose deployment target and add packaging/scripts.
2. Provision Postgres roles, run migrations, and verify RLS.
3. Configure production secrets, HTTPS, origins, and Resend.
4. Set up backups and test restore.
5. Add monitoring/logging/operational runbooks.
6. Run end-to-end auth, org, CRM, email, and privacy validation.
7. Launch with scheduled jobs disabled or single-instance-safe, then enable background sync deliberately.

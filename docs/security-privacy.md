# Security and privacy model

## Tenancy

Organizations are CRME's tenant and security boundary. Every CRM/team record is scoped to an organization. The frontend selects the active organization with the `organization_id` query parameter, and the API stores that selection in request context for repository calls.

Workspaces are not permission boundaries. They are shared organization-level groupings and filters.

## Roles

Organization roles are:

- `owner`
- `admin`
- `member`
- `viewer`

Owners/admins can manage members and invitations. Owners/admins/members can write CRM records. Viewers can read org CRM records, but cannot mutate CRM/team records or connect email accounts.

## RLS backstop

Postgres row-level security is enabled and forced on core org-owned tables, relationship/link tables, suggestion tables, assistant conversations, email tables, and private activity details. The Postgres adapter sets transaction-local context:

- `app.user_id`
- `app.organization_id`
- `app.role`

Application-level authorization remains the first line of defense; RLS is the database backstop for accidental missing filters or unsafe queries. Production deployments should use a non-owner/non-superuser app role. See `docs/database-roles.md`.

## Production baseline

Production deployments should use HTTPS, `APP_ENV=prod`, a strong non-default `MAGIC_LINK_SECRET`, a configured `CRME_SECRET_KEY` for runtime secret encryption, `RESEND_API_KEY`/`RESEND_DOMAIN` for magic-link email delivery, restricted `CRME_ALLOWED_ORIGINS`, and a non-owner/non-superuser Postgres application role. Backups, imported CSVs, mailbox contents, and `.env` files should be treated as private data.

## Email privacy

Email accounts, email messages, and encrypted runtime secrets for mailbox credentials are owner-only. Admins and owners of the organization cannot see another user's mailbox data or resolve another user's mailbox secret unless they own that mailbox.

Email sync can create organization-visible, sanitized activity records such as "Email with client" so the team has relationship context. Full email body/details are stored separately in owner-only `activity_details`; timeline responses only include private detail fields for the owner.

Suggestions are organization-visible because they represent team CRM work, but private email evidence should stay in owner-only detail records rather than being embedded in shared suggestion text.

## Browser extension permissions

The LinkedIn capture extension uses broad `https://*/*` host permissions so it can call self-hosted CRME API deployments on arbitrary HTTPS domains. This is intentional, but it is a security tradeoff because the extension stores a CRME session id locally and sends it to the configured API URL.

Keep content-script execution constrained to LinkedIn pages, and avoid adding behavior that reads or modifies arbitrary non-LinkedIn sites. For managed deployments with known API origins, narrow extension `host_permissions` to those origins instead of `https://*/*`.

See also the root `SECURITY.md`.

## Audit logging

Security-sensitive organization actions are written to organization-scoped `audit_logs`, including member role changes/removals, invitations, invitation acceptance/resend, and email account creation. Audit logs are readable by organization owners/admins only; members/viewers cannot list them.

## Integration test coverage

Database-backed RLS coverage is opt-in because it requires local Postgres:

```bash
tern migrate --config tern.conf --migrations migrations
CRME_POSTGRES_RLS_TEST=1 go test ./internal/adapters/postgres -run TestRLSOrganizationIsolationAndPrivateEmail -count=1 -v
```

The test creates a temporary non-owner database role and verifies cross-org isolation, viewer write denial, member write allowance, org-scoped suggestions/suppressions, owner/admin-only audit logs, owner-only email visibility, owner-only runtime secrets, owner-only activity details, and system email sync enumeration.

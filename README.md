# crme

A team-oriented CRM using Go, Next.js, Postgres, tern migrations, and row-level security.

## Screenshots

![CRME screenshot slideshow](docs/assets/crme-slideshow.webp)

<img src="docs/assets/crme-agent-interaction.webp" alt="CRME agent interaction slideshow" width="420">

## License

CRME is source-available under the PolyForm Noncommercial License 1.0.0. Commercial use is not permitted without a separate commercial license. See [`LICENSE`](LICENSE), [`COMMERCIAL.md`](COMMERCIAL.md), and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Run locally

```bash
cp .env.example .env
# set CRME_SECRET_KEY in .env: openssl rand -base64 32
# set BOOTSTRAP_OWNER_EMAIL to your email for the first login
tern migrate --config tern.conf --migrations migrations
go run ./cmd/server
```

This project expects local Postgres by default. The configured connection string is:

```txt
postgres://postgres:postgres@localhost:5432/crme?sslmode=disable
```

## API

Authenticated CRM requests are scoped to an organization with `?organization_id=...`. Organizations are the tenant/security boundary; workspaces are shared org-level grouping/filtering, not a permission boundary.

- `POST /auth/magic-link`, `GET /auth/verify?token=...`, `POST /auth/logout`
- `GET /me`, `GET /capabilities`, `GET/POST /organizations`
- `GET/PATCH/DELETE /organizations/{id}/members`, `GET/POST /organizations/{id}/invitations`
- `GET/POST /people`, `GET/PUT/PATCH /people/{id}`
- `GET/POST /companies`, `GET/PUT/PATCH /companies/{id}`
- `GET/POST /deals`, `GET/PUT/PATCH /deals/{id}`
- Relationship endpoints under `/relationships/*`
- `POST /activities`, `GET /timeline/{entity_type}/{entity_id}`
- `GET /tags`, `POST /tags`, `POST /tags/attach`
- `GET /search?q=...`
- `POST /todos`, `POST /todos/{id}/complete`, `GET /dashboard/action-items`
- `GET/POST /email/accounts` for each user's own IMAP/SMTP accounts
- `GET /audit-logs` for owner/admin organization audit events
- `GET/POST /ai/prompts`, `POST /ai/prompts/accept`, `POST /ai/prompts/resolve` for in-app suggestions

AI is behind a port. The first adapter is OpenRouter; set `OPENROUTER_API_KEY` to enable generated prompt drafts. Without it, prompt creation still works with the supplied context text.

## Security and privacy notes

- Magic-link URLs are logged only in `APP_ENV=dev` for local development. `APP_ENV=prod` refuses to start unless a non-log sender is configured in code.
- Session IDs are bearer credentials. Use HTTPS in production and revoke the current session with `POST /auth/logout`.
- Run the API with a least-privilege, non-owner Postgres role so row-level security is meaningful. See `docs/database-roles.md` and `docs/security-privacy.md`.
- Email account secrets are encrypted before storage. Set `CRME_SECRET_KEY` to 32 random bytes, base64 encoded, before creating email accounts.
- Email accounts, raw messages, and full email-derived activity details are owner-only. Team timelines show sanitized activity envelopes so relationship context can be shared without exposing mailbox contents.
- In `APP_ENV=prod`, IMAP sync blocks hosts that resolve to private, loopback, link-local, unspecified, or multicast IPs. `APP_ENV=dev` allows those targets for local/self-hosted testing.
- If `OPENROUTER_API_KEY` is set, CRM context sent to AI features is transmitted to OpenRouter. Leave it unset to disable external AI calls.
- The browser extension may request broad host access so it can talk to self-hosted CRME instances on arbitrary domains.

## CLI

`crmctl` does not have a default server. Create an API token in the web app, then save the server and token:

```bash
go run ./cmd/crmctl auth set --api http://localhost:8080 <api-token>
go run ./cmd/crmctl auth show
```

`auth set` saves the server address and token locally. On macOS it uses Keychain when available. `crmctl` authenticates with `CRME_TOKEN` first, then the saved token, then `CRME_SESSION` as a fallback.

```bash
go run ./cmd/crmctl me
go run ./cmd/crmctl people
go run ./cmd/crmctl person-create first_name=Ada last_name=Lovelace email=ada@example.com
# set CRME_SECRET_KEY on the server first (openssl rand -base64 32)
go run ./cmd/crmctl email-account-create name=Work email=me@example.com imap_host=imap.example.com smtp_host=smtp.example.com secret='app-password-or-token'
go run ./cmd/crmctl email-sync
# Optional: set EMAIL_SYNC_INTERVAL=5m on the server for background IMAP polling.
go run ./cmd/crmctl suggestions status=open
go run ./cmd/crmctl dashboard
```

For first-user bootstrap, `BOOTSTRAP_OWNER_EMAIL` must match the email used in the magic-link flow. `CRME_API` overrides the saved API URL for a shell/session.

## Architecture

- `internal/domain`: core entities and business types
- `internal/usecase`: application/business workflows
- `internal/ports`: interfaces required by use cases
- `internal/adapters/postgres`: persistence adapter
- `internal/adapters/httpapi`: HTTP delivery adapter
- `internal/adapters/email`: IMAP/SMTP boundary placeholders
- `internal/adapters/notifications`: prompt/notification boundaries
- `migrations`: tern SQL migrations

See `docs/milestones.md` for the implementation roadmap.

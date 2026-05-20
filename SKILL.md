---
name: crme
description: Use CRME, a team-oriented CRM, via the crmctl CLI. Covers installation from the GitHub repo, authentication via crmctl auth set, safe command usage, reads/writes, notes, tasks, deals, email sync, suggestions, and verification.
version: 1.0.0
author: Hermes Agent
license: PolyForm Noncommercial-1.0.0 source-available project notes
metadata:
  hermes:
    tags: [crme, crm, crmctl, contacts, companies, deals, tasks, email]
---

# CRME / crmctl

Use this skill when the user asks to inspect or modify CRME CRM data, use `crmctl`, log in to CRME, manage people/companies/deals/tasks/notes, sync email, or work with CRME suggestions.

CRME is a source-available team CRM using Go, Next.js, Postgres, tern migrations, and row-level security. The CLI is `crmctl` at `cmd/crmctl` in the CRME repository.

## Safety and privacy

- Treat CRME data as private customer/contact data.
- Do not print full API tokens, session IDs, email app passwords, mailbox secrets, or magic-link tokens.
- Prefer `--json` for agent use so IDs and fields can be parsed exactly.
- Before mutating records, read/search first and use exact IDs returned by CRME. Never guess IDs.
- After every mutation, run the related read command to verify the result.
- For destructive actions such as delete, revoke, member removal, or broad updates, confirm scope with the user unless the request is explicit and narrow.
- For email account creation/update, remind that the server must have `CRME_SECRET_KEY` configured and never echo the mailbox secret back to the user.

## Finding or installing crmctl

First check whether `crmctl` exists:

```bash
command -v crmctl
crmctl auth show
```

If inside a CRME checkout, use:

```bash
go run ./cmd/crmctl <command> --json
```

To install from the GitHub repo into `$GOBIN` / `$GOPATH/bin`:

```bash
git clone git@github.com:ChristianSch/crme.git ~/dev/crme
cd ~/dev/crme
go install ./cmd/crmctl
crmctl auth show
```

If the repo already exists, update and reinstall:

```bash
cd ~/dev/crme
git pull --ff-only
go install ./cmd/crmctl
```

Because the Go module name is currently `crme`, prefer clone + `go install ./cmd/crmctl` over `go install github.com/...@latest`.

For local development server setup from the repo README:

```bash
cp .env.example .env
# set CRME_SECRET_KEY in .env: openssl rand -base64 32
# set BOOTSTRAP_OWNER_EMAIL to the email used for the first magic-link login
tern migrate --config tern.conf --migrations migrations
go run ./cmd/server
```

Default local API URL:

```txt
http://localhost:8080
```

## Authentication model

Use only `crmctl auth set` for CLI authentication. Do not guide agents through magic-link/session-token/API-token creation flows unless the user explicitly asks to debug CRME auth internals.

`crmctl` has no default server. Configure both API URL and token with the token the user already has from CRME:

```bash
crmctl auth set --api http://localhost:8080 <api-token>
crmctl auth show
crmctl me --json
```

Rules for agents:

- The normal login/setup path is exactly: `crmctl auth set --api <api-url> <api-token>`.
- Do not use or recommend `CRME_SESSION` for normal `crmctl` usage.
- Do not run magic-link API calls to obtain sessions or tokens.
- Do not ask users to paste auth secrets into chat unless they explicitly choose to; prefer instructing them to run `crmctl auth set` locally.
- If auth is not configured, stop and ask the user to run `crmctl auth set --api <api-url> <api-token>`.

On macOS, `auth set` stores the token in Keychain when available. Otherwise it stores under the user config directory, with file permissions restricted by the CLI. `CRME_API=<url>` can override the saved server for a single shell/session, but still use `auth set` as the normal setup path.

If `crmctl` is not installed yet but the repo is checked out, substitute `go run ./cmd/crmctl` for `crmctl`.

To clear local auth:

```bash
crmctl auth clear
```

## Quick read-only smoke test

To verify the skill/setup without changing CRM data:

```bash
crmctl auth show
crmctl me --json
crmctl capabilities --json
```

If `crmctl` is not installed but the current directory is a CRME checkout, use:

```bash
go run ./cmd/crmctl auth show
go run ./cmd/crmctl me --json
go run ./cmd/crmctl capabilities --json
```

Do not perform create/update/delete commands when merely testing the skill.

## Command style for agents

Use JSON output almost always:

```bash
crmctl me --json
crmctl search q=ada --json
crmctl people q=ada --json
```

POST, PUT, and PATCH commands accept either simple `key=value` pairs or JSON on stdin / as a single JSON argument.

Use `key=value` for simple writes:

```bash
crmctl person-create first_name=Ada last_name=Lovelace email=ada@example.com --json
crmctl person-update id=<person-id> status=active city=London --json
crmctl company-create name=Acme domain=acme.example --json
crmctl deal-create name="Acme pilot" company_id=<company-id> stage=qualified value_cents=500000 currency=USD --json
```

Use JSON for nested bodies such as activity links:

```bash
crmctl activity-create '{"activity":{"type":"note","body":"Met at conference"},"links":[{"entity_type":"person","entity_id":"<person-id>"}]}' --json
```

Due-date shorthand is supported for tasks:

```bash
crmctl task-create entity_type=person entity_id=<person-id> title="Follow up" due=tomorrow --json
crmctl task-create entity_type=company entity_id=<company-id> title="Renewal check-in" due="in 2 weeks" --json
```

Supported due shorthands include `today`, `tomorrow`, `eom`, `end-of-month`, `end-of-this-month`, `end-of-may`, `in N days`, and `in N weeks`.

## Common read commands

```bash
crmctl me --json
crmctl capabilities --json
crmctl organizations --json
crmctl people q=<name-or-email> --json
crmctl companies q=<name-or-domain> --json
crmctl deals limit=20 --json
crmctl tasks status=open --json
crmctl dashboard --json
crmctl search q=<text> --json
crmctl notes limit=20 --json
crmctl timeline entity_type=person entity_id=<person-id> --json
crmctl tags --json
crmctl workspaces --json
crmctl suggestions status=open --json
crmctl audit-logs limit=20 --json
```

## CRM import / notes-to-CRM triage workflow

When importing notes or messy external context into CRME, do a read-only matching pass before proposing writes:

1. Search for people, companies, and deals mentioned in the note:
   ```bash
   crmctl search q=<person-or-company-or-deal-keyword> --json
   crmctl deals limit=100 --json
   ```
2. For likely matches, inspect existing relationships before creating anything:
   ```bash
   crmctl person-get id=<person-id> --json
   crmctl person-companies id=<person-id> --json
   crmctl company-get id=<company-id> --json
   crmctl company-people id=<company-id> --json
   crmctl deal-get id=<deal-id> --json
   crmctl deal-people id=<deal-id> --json
   crmctl deal-companies id=<deal-id> --json
   ```
3. Check existing tasks/timelines to avoid duplicates:
   ```bash
   crmctl tasks status=open --json
   crmctl timeline entity_type=person entity_id=<person-id> --json
   crmctl timeline entity_type=company entity_id=<company-id> --json
   crmctl timeline entity_type=deal entity_id=<deal-id> --json
   ```
4. Prefer reusing an existing relevant deal over adding notes only to a person/company. If a note is about an active opportunity, attach it to the deal and optionally also to linked people/companies.
5. Before suggesting creation, verify that search did not miss a record by trying alternate spellings, first/last names, company names, email domains, and deal keywords.
6. Present proposed actions grouped as: reuse existing deal, update existing person/company, create missing person/company, add task, needs user confirmation. Do not mutate until the user approves.

If a deal name references a person/company but `deal-people` or `deal-companies` shows missing or wrong links, suggest linking the correct existing record rather than creating a duplicate.

## Common mutation workflows

Find before update:

```bash
crmctl people q=ada --json
crmctl person-update id=<person-id> status=active --json
crmctl person-get id=<person-id> --json
```

Create and link a person/company:

```bash
crmctl person-create first_name=Ada last_name=Lovelace email=ada@example.com --json
crmctl company-create name=Acme domain=acme.example --json
crmctl link-person-company person_id=<person-id> company_id=<company-id> role=buyer --json
crmctl person-companies id=<person-id> --json
```

Create a task and complete it:

```bash
crmctl task-create entity_type=person entity_id=<person-id> title="Follow up" due=tomorrow --json
crmctl tasks status=open --json
crmctl task-complete id=<task-id> --json
crmctl tasks status=open --json
```

Create a note/timeline activity:

```bash
crmctl activity-create '{"activity":{"type":"note","body":"Met at conference"},"links":[{"entity_type":"person","entity_id":"<person-id>"}]}' --json
crmctl timeline entity_type=person entity_id=<person-id> --json
```

Suggestions:

```bash
crmctl suggestions status=open --json
crmctl suggestion-accept id=<suggestion-id> --json
crmctl suggestion-dismiss id=<suggestion-id> --json
crmctl suggestion-suppress id=<suggestion-id> --json
```

Email accounts and sync:

```bash
crmctl email-accounts --json
crmctl email-account-test name=Work email=me@example.com imap_host=imap.example.com smtp_host=smtp.example.com secret='<app-password-or-token>' --json
crmctl email-account-create name=Work email=me@example.com imap_host=imap.example.com smtp_host=smtp.example.com secret='<app-password-or-token>' --json
crmctl email-sync limit=50 --json
```

Server notes for email:

- `CRME_SECRET_KEY` must be set before creating email accounts.
- Optional background sync uses server-side `EMAIL_SYNC_INTERVAL=5m` or similar.
- In production, IMAP sync blocks private/loopback/link-local/unspecified/multicast hosts.

## Troubleshooting

`crmctl is not configured; run: crmctl auth set --api <url> <api-token>`:

- Run `crmctl auth show`.
- If there is no configured auth, ask the user to run `crmctl auth set --api <api-url> <api-token>` locally.

`missing session` or `unauthorized`:

- Verify the API URL shown by `crmctl auth show`.
- Ask the user to re-run `crmctl auth set --api <api-url> <api-token>`.

`forbidden`:

- Check `crmctl me --json` and `crmctl capabilities --json`.
- The token may be viewer-scoped; viewer tokens cannot perform most mutations.
- The token may be scoped to a different organization.

Content-type errors on direct API mutations:

- Send `Content-Type: application/json` for POST/PUT/PATCH with bodies.

Need exact command list:

```bash
crmctl
# or, inside the repo:
go run ./cmd/crmctl
```

The CLI usage output includes all read and mutating commands.

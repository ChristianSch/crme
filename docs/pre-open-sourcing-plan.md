# Pre-open-sourcing plan

This plan captures the main issues to address before publishing CRME as an open-source project.

## Current status

The codebase is close to being publishable, but not ready for an intentional open-source launch yet.

Recent local checks passed:

- `go test ./...`
- `cd frontend && bun run lint && bun run build`
- `cd extension && npm run compile && npm run build`

Current repo hygiene is mostly good: real `.env` files, local dumps, generated bundles, `data/`, `node_modules/`, `.next/`, `.output/`, and `dist/` are ignored. `git ls-files` currently only shows `.env.example` from the env/data/build artifact patterns.

## Goals

- Make the security posture explicit and defensible.
- Give external users a fresh-checkout path that does not depend on private local assumptions.
- Reduce obvious architectural footguns before contributors copy existing patterns.
- Split the largest files enough that the codebase is approachable.
- Document intentional tradeoffs, especially around self-hosting and the browser extension.

## 0. Open-source project basics

These are launch blockers for publishing the repository publicly.

- [ ] Add a root `LICENSE` file and decide the project license.
- [ ] Add `CONTRIBUTING.md` with local setup, test commands, architecture expectations, and PR guidance.
- [ ] Consider adding `CODE_OF_CONDUCT.md` before inviting outside contributors.
- [ ] Add issue templates or a short note telling users where to report bugs, security issues, and support questions.
- [ ] Add CI for the minimum checks:
  - `go test ./...`
  - `cd frontend && bun run lint && bun run build`
  - `cd extension && npm run compile && npm run build`

## 1. Security documentation and defaults

- [x] Add root `SECURITY.md`.
- [x] Document why the browser extension currently needs broad `https://*/*` host permissions for self-hosted CRME API deployments.
- [ ] Review `.env.example` and setup docs for safe local defaults and explicit production warnings.
- [x] Ensure no real secrets, local dumps, generated bundles, or private data are tracked by git.
- [x] Document responsible disclosure / vulnerability reporting process in `SECURITY.md`.
- [x] Clarify production requirements:
  - strong `MAGIC_LINK_SECRET`
  - configured secret encryption key
  - non-superuser Postgres app role
  - HTTPS-only frontend/API deployment
  - secure cookie mode in production
- [ ] Add backup/private-data guidance so users do not accidentally commit dumps, CSV imports, mailbox data, or `.env` files.

## 2. Browser extension hardening

Current finding: `extension/wxt.config.ts` uses broad host permissions:

```ts
host_permissions: ['*://*.linkedin.com/*', 'http://localhost:8080/*', 'https://*/*']
```

This is intentional for self-hosting, but it increases the blast radius because the extension stores a CRME session id locally.

- [ ] Keep content scripts constrained to LinkedIn profile/company pages.
- [ ] Avoid adding behavior that reads or modifies arbitrary non-LinkedIn pages.
- [ ] Consider documenting a managed-distribution variant with narrowed `host_permissions`.
- [ ] Review extension storage of `sessionId` and document revocation guidance.
- [ ] Remove noisy `console.log` scraping/debug output or gate it behind debug mode. Current noisy files include:
  - `extension/entrypoints/content.ts`
  - `extension/utils/linkedin-scraper.ts`
  - `extension/entrypoints/background.ts`
  - `extension/utils/crme-api.ts`

## 3. Usecase / ports-and-adapters cleanup

Current finding: some transaction and orchestration boundaries are still worth reviewing before contributors treat them as examples.

- [x] Extract suggestion acceptance/linking from `AIService` into `SuggestionService`.
- [x] Route suggestion CRM mutations through `CRMService` methods where possible.
- [x] Add missing small usecase methods rather than expanding store usage from orchestration code.
- [x] Move last-owner protection out of `internal/adapters/postgres/store.go` and into `AuthService`.
- [ ] Keep stores as persistence adapters only: no workflow rules, defaults, or validation except persistence constraints.
- [ ] Review `AIService.withStores` / `mergeStores` transaction handling for completeness and consistency.
- [ ] Add or verify tests proving assistant mutating actions go through usecase validation, not direct store mutation.

## 4. Split oversized files

These files are too large for a clean open-source first impression:

- `frontend/src/components/crm-app.tsx` — ~1900 LOC
- `internal/adapters/httpapi/api.go` — ~1500 LOC
- `extension/entrypoints/content.ts` — ~900 LOC
- `extension/utils/linkedin-scraper.ts` — ~600 LOC
- `frontend/src/lib/api.ts` — ~600 LOC
- `cmd/crmctl/main.go` — ~700 LOC

Suggested first splits:

- `internal/adapters/httpapi/api.go`
  - `middleware.go`
  - `auth_handlers.go`
  - `crm_handlers.go`
  - `ai_handlers.go`
  - `email_handlers.go`
  - `dto.go`

- `frontend/src/components/crm-app.tsx`
  - create-record dialog
  - suggestions panel
  - dashboard panel
  - organization/settings panel
  - matching helpers moved to a tested utility module

- `extension/entrypoints/content.ts`
  - page detection
  - injected UI rendering
  - duplicate-check flow
  - capture/update/link actions
  - debug logging helper

## 5. Brittle heuristic review

Current brittle areas:

- LinkedIn DOM scraping in `extension/utils/linkedin-scraper.ts`
- Email signature/contact extraction in `internal/usecase/email.go`
- Frontend-only fuzzy suggestion matching in `frontend/src/components/crm-app.tsx`
- Assistant JSON extraction and action argument parsing in `internal/usecase/ai.go`

Before open sourcing:

- [ ] Add fixture tests for LinkedIn scraper behavior using representative saved HTML snippets.
- [ ] Add tests for email enrichment false positives.
- [ ] Move frontend suggestion matching helpers into a small module with unit tests.
- [x] Replace panic/recover validation in assistant action execution with explicit validation errors.
- [ ] Treat scraper/enrichment results as low-confidence unless explicitly confirmed by the user.

## 6. Authorization review

- [x] Confirm whether `viewer` should be allowed to `POST /email/accounts`.
- [x] If not intentional, remove the exception and add a regression test.
- [x] Re-check route-level permissions against the role model.
- [ ] Keep the opt-in Postgres RLS test documented and easy to run from a fresh checkout.

## 7. Local setup and docs polish

- [x] Implement or document production magic-link email sending.
- [ ] Remove or explain unused config like `SMTP_FROM` if production SMTP is not implemented yet.
- [ ] Ensure migrations and database-role docs are easy to run from a fresh checkout.
- [ ] Add a quick-start path that does not require private local assumptions.
- [ ] Document the expected toolchain versions: Go, tern, Bun, Node/npm, WXT.
- [ ] Decide whether `frontend/package.json` and `extension/package.json` should remain `private: true` for public source.

## 8. Tests to add before publishing

- [ ] Assistant mutating actions use usecase validation.
- [ ] Suggestion accept/link flows are transactional.
- [ ] Viewer write restrictions, including email-account behavior.
- [ ] Last-owner demotion/removal handled in usecase tests.
- [ ] LinkedIn scraper fixture tests.
- [ ] Email enrichment tests for phone/title/website extraction.
- [ ] Frontend suggestion matching helper tests once extracted.
- [ ] CI runs the main backend/frontend/extension checks on every PR.

## Suggested order

1. Add `LICENSE`, contribution docs, and CI.
2. Do a README/setup pass for first external users.
3. Remove or gate extension debug logging.
4. Re-check security defaults and private-data guidance.
5. Split `api.go`, `crm-app.tsx`, and extension content/scraper files enough to make architecture obvious.
6. Add scraper/enrichment/suggestion matching fixture tests.
7. Final public launch review.

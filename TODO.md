# TODO

## Recent backend/security progress

- [x] Magic-link sessions no longer leak through frontend URLs/localStorage.
- [x] Added active `users` table and bootstrapped owner login.
- [x] Sessions are tied to users and can be revoked via `POST /auth/logout`.
- [x] Added Origin checks, request body limits, and basic magic-link rate limiting.
- [x] Split the former god repository port into focused ports.
- [x] Added UnitOfWork transaction boundary and applied it to workspace creates, AI suggestion workflows, and email sync message processing.
- [x] Added explicit HTTP input DTOs and PATCH-like update semantics for core resources.
- [x] Added explicit `PATCH` routes for core update endpoints while keeping `PUT` compatible.
- [x] Added configurable structured logging (`LOG_LEVEL`, `LOG_FORMAT`) and request IDs.
- [x] Added typed error mapping and tests for auth, rate limiting, security middleware, patch semantics, validation, and rollback paths.

## Remaining backend/security follow-ups

### RLS/open-source hardening plan

- [x] Add request/user/org/role DB context plumbing using `app.user_id`, `app.organization_id`, and `app.role` before enabling policies.
- [x] Enable and force RLS on org-owned core tables in phases: workspaces, people, companies, deals, todos, tags, then link tables.
- [x] Add RLS policies for org read/write access: org members can read current org, viewers cannot write, members/admins/owners can write CRM records.
- [x] Add owner/private data model before email privacy RLS: `email_accounts.owner_user_id`, `activity_details.owner_user_id`, and sanitized team-visible activity envelopes.
- [x] Enable and force RLS on private/sensitive tables: `activity_details`, `runtime_secrets`, email accounts/messages, and any future private raw email tables.
- [x] Remove repository fallbacks that allow empty org context once RLS is active everywhere.
- [ ] Use a non-superuser DB role in dev/prod so RLS is meaningful; table owners/superusers can bypass unless `FORCE ROW LEVEL SECURITY` and role setup are correct.
- [ ] Add Postgres integration tests proving cross-org isolation, viewer write denial, member team-management denial, invite email mismatch denial, and private detail owner-only access.
- [x] Keep suggestions team/org-level for now; protect private email evidence by moving full email context into owner-only detail tables rather than hiding the team-level suggestion.

- [ ] Add ownership transfer / additional-owner promotion flow for organizations; current UI protects the last owner but does not offer a way to add another owner.
- [x] Add email integration management UI so users can view, add, update, disable, and remove their own mailbox connections.
- [x] Add route-level HTTP tests for actual create/update/logout handlers, not only helpers.
- [x] Add cleanup for expired/revoked sessions and consumed magic links.
- [ ] Consider env-configurable rate limits if local defaults become annoying.
- [ ] Eventually reserve `PUT` for full replacement once clients use `PATCH`.
- [ ] Add Postgres integration tests for repositories/migrations.
- [x] Add a production magic-link sender for auth (SMTP/Postmark/Resend/etc.); log magic links are dev-only.
- [ ] Add Postgres advisory locks around background jobs if running multiple backend instances.
- [ ] Propagate request IDs through context so downstream auth/usecase logs include the same request id.
- [ ] Add CLI auth docs around `/auth/verify?format=json`.

## Current frontend context

We have a Next.js/Bun frontend in `frontend/` using Tailwind and shadcn/ui. It has real routes/sidebar navigation, tables, side sheets, workspace filtering, tasks, suggestions, and an assistant. The current implementation is functional, but `frontend/src/components/crm-app.tsx` is still too centralized and owns too much orchestration/UI state.

Current important gaps:

- `crm-app.tsx` should continue being split into focused components/hooks, especially suggestions and assistant UI.
- Person/company/deal/task side sheets need a final pass for consistent scroll behavior and reusable sections.
- Activities are collapsible/editable and use a combined `activity-components.tsx`, but the UX is still first-pass.
- Suggestions need a clearer product flow around contact/company creation, linking to existing people, and undo.
- Some frontend polish/confirmation work is in progress and should be reviewed separately.

## Current frontend design/UX follow-ups

- Suggestions flow needs final product-flow work.
  - [x] Reduce equal-weight actions in each suggestion row.
  - [x] Move risky actions like `Never ask again` lower, into overflow, or behind clearer confirmation.
  - Keep create/link/dismiss/suppress understandable under time pressure.
  - Clarify the new-contact path: create person, link person, optional company handling.
- [x] Dashboard prioritization needs redesign.
  - [x] Make the dashboard feel like a prioritized attention queue, not tables placed on a dashboard.
  - [x] Prioritize overdue tasks, due-soon tasks, `my_turn` people, stale deals, and open suggestions.
  - [x] Add clearer grouping and ordering around “what needs me now.”
- Table row interaction clarity needs improvement.
  - Clickable rows, nested linked-entity buttons, and row menus currently compete.
  - Make the primary row open target explicit.
  - Keep nested links visually secondary and predictable.
  - Verify keyboard behavior for row-level actions.
- Side-sheet decluttering is partially done but not finished.
  - Continue hiding secondary create/link/edit forms behind explicit actions.
  - Move rare/destructive actions into quieter menus or confirmed flows where appropriate.
  - Keep side sheets primarily readable by default, with interaction revealed on intent.
- Mobile table experience needs a real design.
  - Current tables are desktop-first with large min widths.
  - Add mobile list layouts for people, companies, deals, and tasks.
  - Preserve the desktop table experience for larger screens.
- [x] Notes information architecture decision.
  - Removed top-level Notes for now.
  - Notes remain contextual inside entity side sheets.
  - Backend `GET /notes` exists but is not used by the frontend while the top-level surface is paused.
- Visual polish items still open.
  - Warm sunset direction works, but tune in browser after more UX changes.
  - [x] Removed colored person avatars; initials are neutral again.
  - [x] Sidebar logo uses the same Avatar/Fallback shape language as initials while remaining a single `C` mark.
  - Redesign the outer elements: main shell and sidebar should feel more grounded and less like oversized rounded containers.
  - Keep softer rounded corners for inner tables, popovers, badges, avatars, and sheet content where it feels tactile.

## Priority 0: Stabilize current UX regressions

- [x] Make every visible button either work or be hidden.
  - [x] Wire the global `Create` button contextually per current view, or remove it until implemented.
  - [x] Wire the `Status` filter per view, or remove it until implemented.
- [x] Verify side sheets scroll internally on smaller screens.
  - [x] Person sheet.
  - [x] Company sheet.
  - [x] Deal sheet.
  - [x] Task sheet.
- [x] Ensure all dropdown/popover lists are constrained and scrollable.
  - [x] Link company in person sheet.
  - [x] Link person/company in suggestions.
  - [x] Link person/company in deal sheet.
- [x] Keep activity cards collapsed by default.
  - [x] Emails should be collapsed by default.
  - [x] Calls, meetings, notes should be collapsed by default.
- [x] Activity editing UX:
  - [x] Date picker changes only the day.
  - [x] Time input changes only the time.
  - [x] Preserve existing time when changing date.
  - [x] Preserve existing date when changing time.

## Priority 1: App structure and navigation

- [x] Replace top pills with a real left sidebar.
  - [x] People.
  - [x] Companies.
  - [x] Deals.
  - [x] Tasks.
  - [x] Suggestions.
  - [x] Removed standalone Notes from primary navigation for now.
- [x] Keep workspace filter globally visible.
- [x] Keep assistant as floating bottom-right popover.
- Split `frontend/src/components/crm-app.tsx` into focused files.
  - [x] `components/app/app-shell.tsx`.
  - [x] `components/app/sidebar-nav.tsx`.
  - [x] `components/workspace-filter.tsx`.
  - [x] `components/tables/people-table.tsx`.
  - [x] `components/tables/companies-table.tsx`.
  - [x] `components/tables/deals-table.tsx`.
  - [x] `components/tables/tasks-table.tsx`.
  - [x] `components/sheets/person-sheet.tsx`.
  - [x] `components/sheets/company-sheet.tsx`.
  - [x] `components/sheets/deal-sheet.tsx`.
  - [x] `components/sheets/task-sheet.tsx`.
  - [x] `components/activity/activity-components.tsx` combines activity card and composer today.
  - [x] `components/suggestions/suggestions-panel.tsx`.
  - [x] `components/assistant/assistant-popover.tsx`.
- [x] Move API types/helpers out of component code and keep `frontend/src/lib/api.ts` as the boundary.

## Priority 1: Deals

Current backend support:

- `GET/POST /deals`.
- `GET/PUT/PATCH /deals/{id}`.
- `GET /deals/{id}/people`.
- `GET /deals/{id}/companies`.
- `POST/DELETE /relationships/deal-person`.
- `POST/DELETE /relationships/deal-company`.
- Activities can link to `entity_type=deal`.
- Tasks can link to `entity_type=deal` and can be queried with `GET /tasks?entity_type=deal&entity_id=...`.

Frontend deal sheet requirements:

- [x] Show linked people, not just picker to link.
- [x] Show linked companies, not just picker to link.
- [x] Show linked tasks/todos.
- [x] Show linked activities.
- [x] Add activity directly to deal.
- [x] Create linked task/todo directly from deal.
- [x] Edit deal stage, value, currency, name.
- Later: pipeline/kanban view by stage.

## Priority 1: Suggestions and HITL

Current behavior:

- Suggestions list open AI prompts.
- `Approve` accepts the prompt.
- `Dismiss` resolves only the prompt.
- `Never ask again` suppresses future suggestions for that email/domain.
- Undo toast exists and stores last undo payload in localStorage.
- `new_contact` suggestions can be linked to an existing person via `POST /ai/prompts/link-person`.

Required improvements:

- For `new_contact`, do not show a separate `new_company` suggestion for the same email by default.
- Product flow for `new_contact` should be explicit:
  - Create new person only.
  - Link to existing person.
  - Optionally create/link company from domain.
  - Optionally link to existing company.
- If approving creates a person/company, undo should use the exact created entity id, not text matching.
- Keep suggestion undo id-based via localStorage.
- Make assistant/HITL actions structured instead of text-derived.
  - Backend should return action options as structured JSON eventually.
  - Frontend should render buttons from structured actions, not heuristics.
- Improve person match quality for suggestions.
  - No random fallback list as a “match.”
  - Show likely matches only.
  - Search manually to pick anyone.

## Priority 1: People and companies

- Person side sheet:
  - Status toggle works, but make status vocabulary explicit.
  - My turn toggle works, but present it as an attention flag.
  - Add/remove linked companies works.
  - Rename relationship field from `Role, optional` to `Role at company` or `Relationship role`.
  - Show secondary email addresses once API exists.
- Add general secondary email API:
  - `GET /people/{id}/emails`.
  - `POST /people/{id}/emails`.
  - `DELETE /people/{id}/emails/{email}` or equivalent.
- Company side sheet:
  - [x] Show linked people from real relation endpoint, not derived from `person.company_name`.
  - Add/remove linked people if needed.
  - Show activities and tasks consistently.

## Priority 2: Create flows

- [x] Wire global `Create` button contextually.
  - [x] Dashboard view: create task.
  - [x] People view: create person.
  - [x] Companies view: create company.
  - [x] Deals view: create deal.
  - [x] Tasks view: create task.
  - [x] Suggestions view: create manual suggestion only if useful, otherwise hide create.
- [x] Prefer inline side sheet create flows over modals.
- Minimum fields:
  - [x] Person: first or last name required, email optional, company optional.
  - [x] Company: name, domain optional.
  - [x] Deal: name, stage, value, currency, linked person/company optional.
  - Task: title/body, due date, linked entity.

## Priority 2: Tasks

- [x] Add real task endpoints.
  - [x] `GET /tasks`.
  - [x] `POST /tasks`.
  - [x] `PUT/PATCH /tasks/{id}`.
  - [x] `POST /tasks/{id}/complete`.
  - [x] `DELETE /tasks/{id}`.
- Improve task filters:
  - [x] `status=open|done|all`.
  - [x] `due=today|overdue|upcoming|none`.
  - [x] `entity_type=person|company|deal`.
  - [x] `entity_id=<uuid>`.
  - [x] `q=<text>`.
- Improve task update support.
  - [x] Edit title/body.
  - [x] Change due date.
  - [x] Edit status.
  - [x] Reopen completed tasks.
  - [x] Link/unlink to person/company/deal after creation.
- Add create task UI from:
  - Tasks view.
  - Person sheet.
  - Company sheet.
  - Deal sheet.
- Improve task display.
  - If title is empty, show first useful line of body.
  - If both are empty, show `Untitled task`.
  - Show overdue/today/upcoming clearly.

## Priority 2: Activities

- Current activity creation exists in frontend for person/company/deal.
- Current activity edit exists with type/body/date/time.
- Improve activity model/API:
  - Consider `GET /activities/{id}`.
  - Consider activity delete.
  - Consider better update semantics and validation.
- Activity UI:
  - Collapse all activities by default.
  - Email bodies collapsed by default.
  - Cap body width and wrap long URLs/tokens.
  - Add clear type labels: Note, Call, Meeting, Email.
  - Date picker controls only date.
  - Time input controls only time.

## Priority 2: Product model cleanup

- Rename user-facing/backend task language from `todo` to `task`.
  - CLI already uses `tasks`, `task-create`, `task-complete`.
  - Backend still exposes `/todos` and stores data in `todos`.
  - Decide whether to migrate DB table `todos -> tasks` or keep DB name internal.
- Keep notes titleless.
  - Notes should be freeform bodies with optional metadata only.
  - Do not introduce required note titles.
- Clarify status vocabularies.
  - Person status.
  - Deal stage.
  - Task status.
  - Suggestion status.

## Priority 3: Dashboard

- [x] Make dashboard broader than tasks.
  - [x] Today dashboard is just open tasks/action items.
  - [x] Target: one prioritized attention feed.
- [x] Dashboard item sources:
  - [x] Open tasks.
  - [x] Overdue tasks.
  - [x] People where `my_turn=true`.
  - [x] Deals with stale stages.
  - [x] AI prompts with `status=open`.
  - [x] Unanswered/recent emails once email sync exists.
  - [x] Upcoming meetings once calendar support exists.
- [x] Add dashboard item shape.
  - [x] `kind`: task, follow_up, stale_deal, ai_prompt, email, meeting.
  - [x] `title`.
  - [x] `body`.
  - [x] `priority`.
  - [x] `due_at` / `at`.
  - [x] linked entity info.

## Priority 3: Scheduled work / reminders

Current support is basic: tasks have `due_at`, and open tasks are sorted by due date.

- Due date filters.
  - `tasks due=today`.
  - `tasks due=overdue`.
  - `tasks due=upcoming`.
- Reminder fields.
  - `remind_at timestamptz`.
  - `reminded_at timestamptz`.
  - optional `reminder_channel` such as cli/email/desktop/webhook.
- Background scheduler.
  - Periodically find tasks where `remind_at <= now()` and `reminded_at is null`.
  - Emit notifications through a port/adapter.
  - Mark `reminded_at` after successful notification.
- Notification adapters.
  - Log adapter for local dev.
  - Email adapter.
  - Optional desktop notification adapter.
  - Optional webhook adapter.
- Recurring tasks.
  - Daily, weekly, monthly, custom interval.
  - On completion, generate next occurrence.
  - Store recurrence metadata separately from one-off tasks.
- Timezone handling.
  - Store timestamps in UTC.
  - Add user/workspace timezone config.
  - CLI should accept local dates like `today`, `tomorrow`, `friday`, `2026-05-15 09:00`.
  - Display dates in local timezone.
- Scheduled activities/meetings.
  - Activities currently have `occurred_at`, history-oriented.
  - Add future scheduled events/meetings separately or extend activities with planned status.
  - Avoid mixing completed timeline events with future commitments.

## Priority 3: Email integration

- Complete email adapters.
  - [x] IMAP inbound fetch exists.
  - SMTP/send support is still missing.
- Improve inbound/outbound sync.
  - [x] Link emails to people by address.
  - [x] Link emails to companies by domain.
  - [x] Add timeline entries.
  - Outbound sync/send still needs implementation.
- Add unanswered email detection.
  - Dashboard item when an important outbound email has no reply after N days.
- Add follow-up task generation.
  - Manual and AI-assisted.
- Suggestion behavior for emails:
  - Unknown person should produce one person-first suggestion.
  - Company should be optional/background, not necessarily a separate suggestion.
  - Suppression skiplist should be explicit and undoable.

## Priority 3: Calendar integration

- Add calendar account model.
  - Provider: Google/Microsoft/CalDAV/manual.
  - Account email/name.
  - Token/secret reference.
- Import upcoming meetings.
  - Link meetings to people/companies by attendee email/domain.
  - Show upcoming meetings on dashboard.
- Create follow-up tasks from meetings.
  - Prompt after meeting ends.
  - Optional AI summary / next action suggestions.

## Priority 4: Importer follow-ups

- Add duplicate protection for unlinked notes/tasks if importer is rerun.
  - People/companies/deals are mostly protected by email/name/domain checks.
  - Notes/tasks currently insert again on rerun.
- Add optional import report file.
  - Counts.
  - Skipped unused companies.
  - Missing references.
  - Empty notes skipped.
- Support association exports if Twenty provides them.
  - Link notes/tasks to people/companies/deals.

## Priority 4: CLI polish

- Expand pretty table support.
  - `person-get`, `company-get`, `deal-get` already render key/value, but could be nicer.
  - Add relation display commands.
- Add command aliases only where product language is clear.
  - Prefer `tasks`, not `todos`.
- Add `--json` documentation examples.
- Add date parsing helpers for task creation.

## Priority 4: Tests

- Add frontend component tests for key flows.
  - Suggestions accept/link/dismiss/suppress.
  - Side sheet activity creation/editing.
  - Workspace filtering.
- [x] Add use case tests for auth, validation, and transaction rollback paths.
- Add Postgres repository integration tests.
- Add importer tests with small fixture CSVs.
- Add CLI output formatting tests.

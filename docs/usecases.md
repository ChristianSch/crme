# CRME Usecases

This is the source of truth for user-facing CRM verbs. The CLI, UI, and assistant should stay aligned with these names.

## Core model

- Person: an individual contact.
- Company: an organization.
- Deal: an opportunity/pipeline item.
- Task: open or completed follow-up work.
- Activity: a timeline event (`note`, `call`, `meeting`, or `email`).
- Note: an activity whose type is `note`.
- Suggestion: an AI-generated prompt that can be accepted, dismissed once, or suppressed.

## People

- List/search people.
- Create a person.
- Update a person.
- Delete a person.
- Link/unlink a person to a company.
- Link/unlink a person to a deal.

CLI verbs: `people`, `person-get`, `person-create`, `person-update`, `person-delete`, `link-person-company`, `unlink-person-company`, `link-deal-person`, `unlink-deal-person`.

## Companies

- List/search companies.
- Create a company.
- Update a company.
- Delete a company.
- Link/unlink a company to a deal.

CLI verbs: `companies`, `company-get`, `company-create`, `company-update`, `company-delete`, `link-deal-company`, `unlink-deal-company`.

## Deals

- List deals.
- Create a deal.
- Update deal fields/stage/value.
- Delete a deal.
- Link/unlink people and companies.

CLI verbs: `deals`, `deal-get`, `deal-create`, `deal-update`, `deal-delete`, `link-deal-person`, `unlink-deal-person`, `link-deal-company`, `unlink-deal-company`.

## Tasks

- List tasks.
- Create a task linked to a person, company, or deal.
- Update a task.
- Complete/reopen a task.
- Delete a task.

CLI verbs: `tasks`, `task-create`, `task-update`, `task-complete`, `task-delete`.

## Activities and notes

Activities are generic timeline events. Notes are a specific activity type.

- Create an activity.
- Update any activity.
- Delete any activity.
- Update a note only when the activity is `type=note`.
- Delete a note only when the activity is `type=note`.

CLI verbs: `activity-create`, `activity-update`, `activity-delete`, `note-update`, `note-delete`, `timeline`.

## Suggestions

- Accept a suggestion.
- Dismiss a suggestion once: mark it dismissed, but allow similar future suggestions.
- Suppress a suggestion: dismiss and suppress the underlying kind/value so it is not suggested again.
- Link a suggestion to an existing person or company.

CLI verbs: `suggestions`, `suggestion-create`, `suggestion-accept`, `suggestion-dismiss`, `suggestion-suppress`, `suggestion-link-person`, `suggestion-link-company`.

## Assistant HITL rule

The assistant proposes crmctl-style actions only:

```json
{"text":"...","pending_action":{"command":"task-create","args":["entity_type=person","entity_id=...","title=..."]}}
```

The UI renders only Confirm/Cancel. Confirm executes the corresponding normal REST call from the frontend. Pending actions are not stored in the database.

Assistant proposed mutating commands must be valid CLI verbs and must also be executable by the frontend assistant action executor.

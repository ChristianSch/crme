# CRM milestones

## M0 - Foundation
- Go module, hexagonal package layout
- Config, HTTP server, health check
- Postgres schema with tern migrations
- Repository/use-case boundaries

## M1 - Auth
- In-house magic-link request/verify flow
- Session persistence and middleware
- Pluggable sender for dev logs now, SMTP later

## M2 - Core CRM
- People, companies, deals, activities, tags
- Person/company many-to-many
- Deal/person and deal/company links
- Activities attachable to any entity
- Todos on people, companies, and deals
- Entity timeline/feed

## M3 - Search + dashboard
- Postgres full-text/trigram search
- Action-item dashboard across todos, stale deals, stale follow-ups

## M4 - Email integration
- Multiple IMAP/SMTP accounts per CRM instance
- Account credentials by secret reference, not plaintext DB storage
- IMAP sync workers
- SMTP send
- Email threading per contact
- Match incoming emails to contacts/companies by address/domain

## M5 - Native AI workflows
- New-contact prompt from inbound email
- Fuzzy merge prompt
- Follow-up reminder prompts
- Deal-stage nudge prompts
- Notification channel: in-app prompts first, then email digest/Slack webhook
- AI provider is a port; OpenRouter is the first adapter

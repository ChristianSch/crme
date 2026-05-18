# Security

See [`docs/security-privacy.md`](docs/security-privacy.md) for CRME's security and privacy model.

## Reporting vulnerabilities

CRME is not ready for a public bug bounty. If you find a vulnerability, please report it privately to the project maintainer instead of opening a public issue with exploit details. Include affected versions/commits, reproduction steps, impact, and any relevant logs or screenshots.

## Production deployment requirements

Before running CRME in production:

- Set a strong, unique `MAGIC_LINK_SECRET`; never use the development default.
- Set `CRME_SECRET_KEY` to 32 random bytes, base64 encoded, before storing email account secrets.
- Serve the frontend and API over HTTPS so session cookies can be marked secure.
- Run the API with `APP_ENV=prod` so secure-cookie behavior and production validation are enabled.
- Use a non-owner/non-superuser Postgres application role. See [`docs/database-roles.md`](docs/database-roles.md).
- Set `RESEND_API_KEY` and `RESEND_DOMAIN` for production magic-link email delivery.
- Restrict `CRME_ALLOWED_ORIGINS` to trusted frontend and extension origins.
- Treat database backups, imported CSVs, mailbox contents, and `.env` files as private data.

## Browser extension host permissions

The CRME LinkedIn browser extension declares broad `https://*/*` host permissions so it can connect to self-hosted CRME API deployments on arbitrary HTTPS domains. This is intentional: users may run CRME on their own domain rather than `localhost` or a fixed hosted origin.

This broad permission is a security tradeoff. The extension stores a CRME session id locally and sends it as `X-CRM-Session` to the configured CRME API URL. Keep the extension's content-script surface limited to LinkedIn pages and avoid adding code that reads or modifies arbitrary non-LinkedIn pages.

If CRME is distributed through a controlled environment with known API origins, prefer narrowing `host_permissions` to those origins instead of `https://*/*`.

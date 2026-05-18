# Deploy to Fly.io

This is the manual self-hosting deployment path for running CRME as two Fly apps:

- frontend app: serves the Next.js UI
- API app: serves the Go backend

Database migrations are not run by Fly. Run `tern` yourself from your local machine when you choose to migrate the database.

## Runtime shape

Example host layout:

- `https://app.example.com` → frontend Fly app
- `https://api.example.com` → API Fly app

Use your own domains/app names in place of the examples.

## One-time setup

```bash
fly auth login
fly apps create crme-api
fly apps create crme-web
```

Create local Fly config files from the public examples:

```bash
cp fly.api.example.toml fly.api.toml
cp fly.web.example.toml fly.web.toml
```

Then edit the local files for your Fly app names, domains, and region. The local `fly*.toml` files are gitignored so deployment-specific values do not get committed.

Pick a region close to your database and set `primary_region` in both local Fly config files, for example:

```toml
primary_region = "fra"
```

## API app secrets

Use the database runtime app role for `DATABASE_URL`, not the migration/owner role.

```bash
fly secrets set -a crme-api \
  APP_ENV='prod' \
  HTTP_ADDR=':8080' \
  DATABASE_URL='postgres://crme_app:...@.../...?...sslmode=require' \
  APP_BASE_URL='https://api.example.com' \
  FRONTEND_BASE_URL='https://app.example.com' \
  CRME_ALLOWED_ORIGINS='https://app.example.com' \
  MAGIC_LINK_SECRET='replace-with-strong-random-secret' \
  CRME_SECRET_KEY='replace-with-openssl-rand-base64-32' \
  RESEND_API_KEY='re_...' \
  RESEND_DOMAIN='mail.example.com' \
  LOG_LEVEL='info' \
  LOG_FORMAT='json' \
  HOUSEKEEPING_INTERVAL='1h'
```

Generate `CRME_SECRET_KEY` with:

```bash
openssl rand -base64 32
```

Optional API secrets:

```bash
fly secrets set -a crme-api OPENROUTER_API_KEY='...' OPENROUTER_MODEL='openai/gpt-4o-mini'
```

If you keep a local API env file, import it with:

```bash
fly secrets import -a crme-api < .env.prod
```

## Frontend app API URL

The frontend needs to know the public API URL at build time. Set these in your local `fly.web.toml` under `[build.args]` before deploying:

```toml
[build]
  dockerfile = "Dockerfile.web"

  [build.args]
    NEXT_PUBLIC_API_URL = "https://api.example.com"
    CRME_API_URL = "https://api.example.com"
```

`NEXT_PUBLIC_API_URL` is used by browser-side requests. `CRME_API_URL` is used by Next.js rewrites if requests go through `/api/*`.

You can also keep the same values in `[env]` for runtime consistency.

## Run migrations manually

Fly does not run this step during deploy or startup. Run migrations manually from your local machine with the database migration/owner role:

```bash
DATABASE_URL='postgres://crme_owner:...@.../...?...sslmode=require' \
  tern migrate --config tern.conf --migrations migrations
```

If a deploy does not include schema changes, skip this step.

## Deploy

Deploy the API:

```bash
fly deploy -a crme-api -c fly.api.toml
```

Deploy the frontend:

```bash
fly deploy -a crme-web -c fly.web.toml
```

## Custom domains

Add the API hostname to the API app:

```bash
fly certs add -a crme-api api.example.com
fly certs show -a crme-api api.example.com
```

Add the frontend hostname to the frontend app:

```bash
fly certs add -a crme-web app.example.com
fly certs show -a crme-web app.example.com
```

In DNS, point each hostname at the matching Fly app:

```txt
app -> crme-web.fly.dev
api -> crme-api.fly.dev
```

## Verify

```bash
curl https://api.example.com/healthz
curl -I https://app.example.com
fly logs -a crme-api
fly logs -a crme-web
```

## Repeat deploy checklist

```bash
go test ./...
cd frontend && bun run lint && bun run build
cd ../extension && npm run compile && npm run build
cd ..

# If this release includes schema changes, run tern manually first.
DATABASE_URL='postgres://crme_owner:...@.../...?...sslmode=require' \
  tern migrate --config tern.conf --migrations migrations

fly deploy -a crme-api -c fly.api.toml
fly deploy -a crme-web -c fly.web.toml
curl https://api.example.com/healthz
```

create table api_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index api_tokens_user_org_idx on api_tokens(user_id, organization_id) where revoked_at is null;

alter table api_tokens enable row level security;
alter table api_tokens force row level security;

create policy api_tokens_auth_select on api_tokens for select using (
  current_setting('app.role', true) = 'authenticator'
  or (organization_id::text = current_setting('app.organization_id', true) and user_id::text = current_setting('app.user_id', true))
);
create policy api_tokens_auth_insert on api_tokens for insert with check (
  current_setting('app.role', true) = 'authenticator'
  or (organization_id::text = current_setting('app.organization_id', true) and user_id::text = current_setting('app.user_id', true))
);
create policy api_tokens_auth_update on api_tokens for update using (
  current_setting('app.role', true) = 'authenticator'
  or (organization_id::text = current_setting('app.organization_id', true) and user_id::text = current_setting('app.user_id', true))
) with check (
  current_setting('app.role', true) = 'authenticator'
  or (organization_id::text = current_setting('app.organization_id', true) and user_id::text = current_setting('app.user_id', true))
);

---- create above / drop below ----

drop policy if exists api_tokens_auth_update on api_tokens;
drop policy if exists api_tokens_auth_insert on api_tokens;
drop policy if exists api_tokens_auth_select on api_tokens;
alter table api_tokens no force row level security;
alter table api_tokens disable row level security;
drop table if exists api_tokens;

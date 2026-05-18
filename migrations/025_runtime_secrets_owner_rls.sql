alter table runtime_secrets add column organization_id uuid references organizations(id) on delete cascade;
alter table runtime_secrets add column owner_user_id uuid references users(id) on delete cascade;

update runtime_secrets rs
set organization_id = ea.organization_id,
    owner_user_id = ea.owner_user_id
from email_accounts ea
where ea.secret_ref = 'runtime_secret:' || rs.id::text
  and rs.organization_id is null
  and rs.owner_user_id is null;

create index runtime_secrets_organization_idx on runtime_secrets (organization_id, created_at desc);
create index runtime_secrets_owner_idx on runtime_secrets (owner_user_id, created_at desc);

alter table runtime_secrets enable row level security;
alter table runtime_secrets force row level security;
create policy runtime_secrets_owner_select on runtime_secrets for select using (owner_user_id::text = current_setting('app.user_id', true) or current_setting('app.role', true) = 'system');
create policy runtime_secrets_owner_insert on runtime_secrets for insert with check (owner_user_id::text = current_setting('app.user_id', true));
create policy runtime_secrets_owner_update on runtime_secrets for update using (owner_user_id::text = current_setting('app.user_id', true)) with check (owner_user_id::text = current_setting('app.user_id', true));
create policy runtime_secrets_owner_delete on runtime_secrets for delete using (owner_user_id::text = current_setting('app.user_id', true));

---- create above / drop below ----

drop policy if exists runtime_secrets_owner_delete on runtime_secrets;
drop policy if exists runtime_secrets_owner_update on runtime_secrets;
drop policy if exists runtime_secrets_owner_insert on runtime_secrets;
drop policy if exists runtime_secrets_owner_select on runtime_secrets;
alter table runtime_secrets no force row level security;
alter table runtime_secrets disable row level security;

drop index if exists runtime_secrets_owner_idx;
drop index if exists runtime_secrets_organization_idx;
alter table runtime_secrets drop column if exists owner_user_id;
alter table runtime_secrets drop column if exists organization_id;

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  target_type text not null default '',
  target_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_logs_organization_idx on audit_logs (organization_id, created_at desc);
create index audit_logs_actor_idx on audit_logs (actor_user_id, created_at desc);
create index audit_logs_action_idx on audit_logs (organization_id, action, created_at desc);

alter table audit_logs enable row level security;
alter table audit_logs force row level security;
create policy audit_logs_org_admin_select on audit_logs for select using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin'));
create policy audit_logs_org_insert on audit_logs for insert with check (organization_id::text = current_setting('app.organization_id', true) and (actor_user_id::text = current_setting('app.user_id', true) or actor_user_id is null) and current_setting('app.role', true) in ('owner','admin','member','viewer'));

---- create above / drop below ----

drop policy if exists audit_logs_org_insert on audit_logs;
drop policy if exists audit_logs_org_admin_select on audit_logs;
alter table audit_logs no force row level security;
alter table audit_logs disable row level security;
drop index if exists audit_logs_action_idx;
drop index if exists audit_logs_actor_idx;
drop index if exists audit_logs_organization_idx;
drop table if exists audit_logs;

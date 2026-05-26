-- +tern Up
create table email_sync_cursors (
  organization_id uuid not null references organizations(id) on delete cascade,
  owner_user_id uuid not null references users(id) on delete cascade,
  email_account_id uuid not null references email_accounts(id) on delete cascade,
  folder text not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (email_account_id, folder)
);

create index email_sync_cursors_owner_idx on email_sync_cursors (owner_user_id, updated_at desc);
create index email_sync_cursors_org_account_idx on email_sync_cursors (organization_id, email_account_id);

alter table email_sync_cursors enable row level security;
alter table email_sync_cursors force row level security;
create policy email_sync_cursors_owner_select on email_sync_cursors for select using (owner_user_id::text = current_setting('app.user_id', true) or current_setting('app.role', true) = 'system');
create policy email_sync_cursors_owner_insert on email_sync_cursors for insert with check (owner_user_id::text = current_setting('app.user_id', true) or current_setting('app.role', true) = 'system');
create policy email_sync_cursors_owner_update on email_sync_cursors for update using (owner_user_id::text = current_setting('app.user_id', true) or current_setting('app.role', true) = 'system') with check (owner_user_id::text = current_setting('app.user_id', true) or current_setting('app.role', true) = 'system');
create policy email_sync_cursors_owner_delete on email_sync_cursors for delete using (owner_user_id::text = current_setting('app.user_id', true) or current_setting('app.role', true) = 'system');

-- +tern Down
drop policy if exists email_sync_cursors_owner_delete on email_sync_cursors;
drop policy if exists email_sync_cursors_owner_update on email_sync_cursors;
drop policy if exists email_sync_cursors_owner_insert on email_sync_cursors;
drop policy if exists email_sync_cursors_owner_select on email_sync_cursors;
alter table email_sync_cursors no force row level security;
alter table email_sync_cursors disable row level security;
drop index if exists email_sync_cursors_org_account_idx;
drop index if exists email_sync_cursors_owner_idx;
drop table if exists email_sync_cursors;

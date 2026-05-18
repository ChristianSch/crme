alter table email_accounts add column owner_user_id uuid references users(id) on delete set null;

update email_accounts ea
set owner_user_id = (
  select om.user_id
  from organization_members om
  where om.organization_id = ea.organization_id
  order by case om.role when 'owner' then 0 when 'admin' then 1 when 'member' then 2 else 3 end, om.created_at asc
  limit 1
)
where ea.owner_user_id is null;

alter table email_accounts alter column owner_user_id set not null;
create index email_accounts_owner_idx on email_accounts (owner_user_id, created_at desc);

create table activity_details (
  activity_id uuid primary key references activities(id) on delete cascade,
  owner_user_id uuid not null references users(id) on delete cascade,
  body_text text not null default '',
  raw jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_details_owner_idx on activity_details (owner_user_id, created_at desc);

alter table activity_details enable row level security;
alter table activity_details force row level security;
create policy activity_details_owner_select on activity_details for select using (owner_user_id::text = current_setting('app.user_id', true));
create policy activity_details_owner_insert on activity_details for insert with check (owner_user_id::text = current_setting('app.user_id', true));
create policy activity_details_owner_update on activity_details for update using (owner_user_id::text = current_setting('app.user_id', true)) with check (owner_user_id::text = current_setting('app.user_id', true));
create policy activity_details_owner_delete on activity_details for delete using (owner_user_id::text = current_setting('app.user_id', true));

---- create above / drop below ----

drop policy if exists activity_details_owner_delete on activity_details;
drop policy if exists activity_details_owner_update on activity_details;
drop policy if exists activity_details_owner_insert on activity_details;
drop policy if exists activity_details_owner_select on activity_details;
alter table activity_details no force row level security;
alter table activity_details disable row level security;
drop index if exists activity_details_owner_idx;
drop table if exists activity_details;

drop index if exists email_accounts_owner_idx;
alter table email_accounts drop column if exists owner_user_id;

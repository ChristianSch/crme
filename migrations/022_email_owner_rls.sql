alter table email_messages add column owner_user_id uuid references users(id) on delete cascade;

update email_messages em
set owner_user_id = ea.owner_user_id
from email_accounts ea
where em.email_account_id = ea.id
  and em.owner_user_id is null;

update email_messages em
set owner_user_id = (
  select om.user_id
  from organization_members om
  where om.organization_id = em.organization_id
  order by case om.role when 'owner' then 0 when 'admin' then 1 when 'member' then 2 else 3 end, om.created_at asc
  limit 1
)
where em.owner_user_id is null;

alter table email_messages alter column owner_user_id set not null;
create index email_messages_owner_idx on email_messages (owner_user_id, sent_at desc);

alter table email_accounts enable row level security;
alter table email_accounts force row level security;
create policy email_accounts_owner_select on email_accounts for select using (owner_user_id::text = current_setting('app.user_id', true));
create policy email_accounts_owner_insert on email_accounts for insert with check (owner_user_id::text = current_setting('app.user_id', true));
create policy email_accounts_owner_update on email_accounts for update using (owner_user_id::text = current_setting('app.user_id', true)) with check (owner_user_id::text = current_setting('app.user_id', true));
create policy email_accounts_owner_delete on email_accounts for delete using (owner_user_id::text = current_setting('app.user_id', true));

alter table email_messages enable row level security;
alter table email_messages force row level security;
create policy email_messages_owner_select on email_messages for select using (owner_user_id::text = current_setting('app.user_id', true));
create policy email_messages_owner_insert on email_messages for insert with check (owner_user_id::text = current_setting('app.user_id', true));
create policy email_messages_owner_update on email_messages for update using (owner_user_id::text = current_setting('app.user_id', true)) with check (owner_user_id::text = current_setting('app.user_id', true));
create policy email_messages_owner_delete on email_messages for delete using (owner_user_id::text = current_setting('app.user_id', true));

---- create above / drop below ----

drop policy if exists email_messages_owner_delete on email_messages;
drop policy if exists email_messages_owner_update on email_messages;
drop policy if exists email_messages_owner_insert on email_messages;
drop policy if exists email_messages_owner_select on email_messages;
alter table email_messages no force row level security;
alter table email_messages disable row level security;

drop policy if exists email_accounts_owner_delete on email_accounts;
drop policy if exists email_accounts_owner_update on email_accounts;
drop policy if exists email_accounts_owner_insert on email_accounts;
drop policy if exists email_accounts_owner_select on email_accounts;
alter table email_accounts no force row level security;
alter table email_accounts disable row level security;

drop index if exists email_messages_owner_idx;
alter table email_messages drop column if exists owner_user_id;

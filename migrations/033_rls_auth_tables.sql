alter table users enable row level security;
alter table users force row level security;
create policy users_auth_select on users for select using (
  current_setting('app.role', true) = 'authenticator'
  or id::text = current_setting('app.user_id', true)
  or exists (
    select 1 from organization_members om
    where om.user_id = users.id
      and om.organization_id::text = current_setting('app.organization_id', true)
  )
);
create policy users_auth_insert on users for insert with check (current_setting('app.role', true) = 'authenticator');

alter table sessions enable row level security;
alter table sessions force row level security;
create policy sessions_auth_select on sessions for select using (current_setting('app.role', true) = 'authenticator');
create policy sessions_auth_insert on sessions for insert with check (current_setting('app.role', true) = 'authenticator');
create policy sessions_auth_update on sessions for update using (current_setting('app.role', true) = 'authenticator') with check (current_setting('app.role', true) = 'authenticator');
create policy sessions_auth_delete on sessions for delete using (current_setting('app.role', true) = 'authenticator');

alter table magic_links enable row level security;
alter table magic_links force row level security;
create policy magic_links_auth_select on magic_links for select using (current_setting('app.role', true) = 'authenticator');
create policy magic_links_auth_insert on magic_links for insert with check (current_setting('app.role', true) = 'authenticator');
create policy magic_links_auth_update on magic_links for update using (current_setting('app.role', true) = 'authenticator') with check (current_setting('app.role', true) = 'authenticator');
create policy magic_links_auth_delete on magic_links for delete using (current_setting('app.role', true) = 'authenticator');

drop policy if exists assistant_conversations_org_delete on assistant_conversations;
create policy assistant_conversations_org_delete on assistant_conversations for delete using (
  organization_id::text = current_setting('app.organization_id', true)
  or current_setting('app.role', true) = 'system'
);

---- create above / drop below ----

drop policy if exists assistant_conversations_org_delete on assistant_conversations;
create policy assistant_conversations_org_delete on assistant_conversations for delete using (organization_id::text = current_setting('app.organization_id', true));

drop policy if exists magic_links_auth_delete on magic_links;
drop policy if exists magic_links_auth_update on magic_links;
drop policy if exists magic_links_auth_insert on magic_links;
drop policy if exists magic_links_auth_select on magic_links;
alter table magic_links no force row level security;
alter table magic_links disable row level security;

drop policy if exists sessions_auth_delete on sessions;
drop policy if exists sessions_auth_update on sessions;
drop policy if exists sessions_auth_insert on sessions;
drop policy if exists sessions_auth_select on sessions;
alter table sessions no force row level security;
alter table sessions disable row level security;

drop policy if exists users_auth_insert on users;
drop policy if exists users_auth_select on users;
alter table users no force row level security;
alter table users disable row level security;

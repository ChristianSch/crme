alter table organizations enable row level security;
alter table organizations force row level security;
create policy organizations_member_select on organizations for select using (
  id::text = current_setting('app.organization_id', true)
  or exists (select 1 from organization_members om where om.organization_id = organizations.id and om.user_id::text = current_setting('app.user_id', true))
);
create policy organizations_user_insert on organizations for insert with check (current_setting('app.user_id', true) <> '');
create policy organizations_admin_update on organizations for update using (
  id::text = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('owner','admin')
) with check (id::text = current_setting('app.organization_id', true));
create policy organizations_owner_delete on organizations for delete using (
  id::text = current_setting('app.organization_id', true)
  and current_setting('app.role', true) = 'owner'
);

alter table organization_members enable row level security;
alter table organization_members force row level security;
create policy organization_members_org_select on organization_members for select using (
  user_id::text = current_setting('app.user_id', true)
  or organization_id::text = current_setting('app.organization_id', true)
);
create policy organization_members_org_insert on organization_members for insert with check (
  (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin'))
  or (current_setting('app.organization_id', true) = '' and user_id::text = current_setting('app.user_id', true) and role = 'owner')
  or (organization_id::text = current_setting('app.organization_id', true) and user_id::text = current_setting('app.user_id', true) and role = current_setting('app.role', true))
);
create policy organization_members_org_update on organization_members for update using (
  organization_id::text = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('owner','admin')
) with check (organization_id::text = current_setting('app.organization_id', true));
create policy organization_members_org_delete on organization_members for delete using (
  organization_id::text = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('owner','admin')
);

alter table organization_invitations enable row level security;
alter table organization_invitations force row level security;
create policy organization_invitations_org_select on organization_invitations for select using (
  organization_id::text = current_setting('app.organization_id', true)
  or lower(email) = (select lower(u.email) from users u where u.id::text = current_setting('app.user_id', true))
);
create policy organization_invitations_org_insert on organization_invitations for insert with check (
  organization_id::text = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('owner','admin')
);
create policy organization_invitations_org_update on organization_invitations for update using (
  (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin'))
  or lower(email) = (select lower(u.email) from users u where u.id::text = current_setting('app.user_id', true))
) with check (
  organization_id::text = current_setting('app.organization_id', true)
  or lower(email) = (select lower(u.email) from users u where u.id::text = current_setting('app.user_id', true))
);

---- create above / drop below ----

drop policy if exists organization_invitations_org_update on organization_invitations;
drop policy if exists organization_invitations_org_insert on organization_invitations;
drop policy if exists organization_invitations_org_select on organization_invitations;
alter table organization_invitations no force row level security;
alter table organization_invitations disable row level security;

drop policy if exists organization_members_org_delete on organization_members;
drop policy if exists organization_members_org_update on organization_members;
drop policy if exists organization_members_org_insert on organization_members;
drop policy if exists organization_members_org_select on organization_members;
alter table organization_members no force row level security;
alter table organization_members disable row level security;

drop policy if exists organizations_owner_delete on organizations;
drop policy if exists organizations_admin_update on organizations;
drop policy if exists organizations_user_insert on organizations;
drop policy if exists organizations_member_select on organizations;
alter table organizations no force row level security;
alter table organizations disable row level security;

alter table workspaces enable row level security;
alter table workspaces force row level security;
create policy workspaces_org_select on workspaces for select using (organization_id::text = current_setting('app.organization_id', true));
create policy workspaces_org_insert on workspaces for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy workspaces_org_update on workspaces for update using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member')) with check (organization_id::text = current_setting('app.organization_id', true));
create policy workspaces_org_delete on workspaces for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table people enable row level security;
alter table people force row level security;
create policy people_org_select on people for select using (organization_id::text = current_setting('app.organization_id', true));
create policy people_org_insert on people for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy people_org_update on people for update using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member')) with check (organization_id::text = current_setting('app.organization_id', true));
create policy people_org_delete on people for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table companies enable row level security;
alter table companies force row level security;
create policy companies_org_select on companies for select using (organization_id::text = current_setting('app.organization_id', true));
create policy companies_org_insert on companies for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy companies_org_update on companies for update using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member')) with check (organization_id::text = current_setting('app.organization_id', true));
create policy companies_org_delete on companies for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table deals enable row level security;
alter table deals force row level security;
create policy deals_org_select on deals for select using (organization_id::text = current_setting('app.organization_id', true));
create policy deals_org_insert on deals for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy deals_org_update on deals for update using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member')) with check (organization_id::text = current_setting('app.organization_id', true));
create policy deals_org_delete on deals for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table todos enable row level security;
alter table todos force row level security;
create policy todos_org_select on todos for select using (organization_id::text = current_setting('app.organization_id', true));
create policy todos_org_insert on todos for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy todos_org_update on todos for update using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member')) with check (organization_id::text = current_setting('app.organization_id', true));
create policy todos_org_delete on todos for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table tags enable row level security;
alter table tags force row level security;
create policy tags_org_select on tags for select using (organization_id::text = current_setting('app.organization_id', true));
create policy tags_org_insert on tags for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy tags_org_update on tags for update using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member')) with check (organization_id::text = current_setting('app.organization_id', true));
create policy tags_org_delete on tags for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

---- create above / drop below ----

drop policy if exists tags_org_delete on tags;
drop policy if exists tags_org_update on tags;
drop policy if exists tags_org_insert on tags;
drop policy if exists tags_org_select on tags;
alter table tags no force row level security;
alter table tags disable row level security;

drop policy if exists todos_org_delete on todos;
drop policy if exists todos_org_update on todos;
drop policy if exists todos_org_insert on todos;
drop policy if exists todos_org_select on todos;
alter table todos no force row level security;
alter table todos disable row level security;

drop policy if exists deals_org_delete on deals;
drop policy if exists deals_org_update on deals;
drop policy if exists deals_org_insert on deals;
drop policy if exists deals_org_select on deals;
alter table deals no force row level security;
alter table deals disable row level security;

drop policy if exists companies_org_delete on companies;
drop policy if exists companies_org_update on companies;
drop policy if exists companies_org_insert on companies;
drop policy if exists companies_org_select on companies;
alter table companies no force row level security;
alter table companies disable row level security;

drop policy if exists people_org_delete on people;
drop policy if exists people_org_update on people;
drop policy if exists people_org_insert on people;
drop policy if exists people_org_select on people;
alter table people no force row level security;
alter table people disable row level security;

drop policy if exists workspaces_org_delete on workspaces;
drop policy if exists workspaces_org_update on workspaces;
drop policy if exists workspaces_org_insert on workspaces;
drop policy if exists workspaces_org_select on workspaces;
alter table workspaces no force row level security;
alter table workspaces disable row level security;

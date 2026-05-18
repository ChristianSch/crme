alter table person_emails enable row level security;
alter table person_emails force row level security;
create policy person_emails_org_select on person_emails for select using (organization_id::text = current_setting('app.organization_id', true));
create policy person_emails_org_insert on person_emails for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy person_emails_org_update on person_emails for update using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member')) with check (organization_id::text = current_setting('app.organization_id', true));
create policy person_emails_org_delete on person_emails for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table company_domains enable row level security;
alter table company_domains force row level security;
create policy company_domains_org_select on company_domains for select using (organization_id::text = current_setting('app.organization_id', true));
create policy company_domains_org_insert on company_domains for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy company_domains_org_update on company_domains for update using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member')) with check (organization_id::text = current_setting('app.organization_id', true));
create policy company_domains_org_delete on company_domains for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

---- create above / drop below ----

drop policy if exists company_domains_org_delete on company_domains;
drop policy if exists company_domains_org_update on company_domains;
drop policy if exists company_domains_org_insert on company_domains;
drop policy if exists company_domains_org_select on company_domains;
alter table company_domains no force row level security;
alter table company_domains disable row level security;

drop policy if exists person_emails_org_delete on person_emails;
drop policy if exists person_emails_org_update on person_emails;
drop policy if exists person_emails_org_insert on person_emails;
drop policy if exists person_emails_org_select on person_emails;
alter table person_emails no force row level security;
alter table person_emails disable row level security;

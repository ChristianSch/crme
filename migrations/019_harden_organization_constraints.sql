alter table workspaces alter column organization_id set not null;
alter table people alter column organization_id set not null;
alter table companies alter column organization_id set not null;
alter table deals alter column organization_id set not null;
alter table todos alter column organization_id set not null;
alter table activities alter column organization_id set not null;
alter table tags alter column organization_id set not null;
alter table email_accounts alter column organization_id set not null;
alter table email_messages alter column organization_id set not null;
alter table assistant_conversations alter column organization_id set not null;
alter table person_emails alter column organization_id set not null;
alter table company_domains alter column organization_id set not null;
alter table person_companies alter column organization_id set not null;
alter table deal_people alter column organization_id set not null;
alter table deal_companies alter column organization_id set not null;
alter table activity_links alter column organization_id set not null;
alter table entity_tags alter column organization_id set not null;
alter table workspace_people alter column organization_id set not null;
alter table workspace_companies alter column organization_id set not null;

drop index if exists people_email_unique;
drop index if exists companies_domain_unique;
drop index if exists person_emails_email_unique;
drop index if exists company_domains_domain_unique;
drop index if exists email_accounts_email_unique;

alter table workspaces drop constraint if exists workspaces_name_key;
alter table tags drop constraint if exists tags_name_key;

create unique index people_organization_email_unique on people (organization_id, lower(email)) where email <> '';
create unique index companies_organization_domain_unique on companies (organization_id, lower(domain)) where domain <> '';
create unique index person_emails_organization_email_unique on person_emails (organization_id, lower(email));
create unique index company_domains_organization_domain_unique on company_domains (organization_id, lower(domain));
create unique index email_accounts_organization_email_unique on email_accounts (organization_id, lower(email));
create unique index workspaces_organization_name_unique on workspaces (organization_id, lower(name));
create unique index tags_organization_name_unique on tags (organization_id, lower(name));

---- create above / drop below ----

drop index if exists tags_organization_name_unique;
drop index if exists workspaces_organization_name_unique;
drop index if exists email_accounts_organization_email_unique;
drop index if exists company_domains_organization_domain_unique;
drop index if exists person_emails_organization_email_unique;
drop index if exists companies_organization_domain_unique;
drop index if exists people_organization_email_unique;

alter table tags add constraint tags_name_key unique (name);
alter table workspaces add constraint workspaces_name_key unique (name);
create unique index people_email_unique on people (lower(email)) where email <> '';
create unique index companies_domain_unique on companies (lower(domain)) where domain <> '';
create unique index person_emails_email_unique on person_emails (lower(email));
create unique index company_domains_domain_unique on company_domains (lower(domain));
create unique index email_accounts_email_unique on email_accounts (lower(email));

alter table workspace_companies alter column organization_id drop not null;
alter table workspace_people alter column organization_id drop not null;
alter table entity_tags alter column organization_id drop not null;
alter table activity_links alter column organization_id drop not null;
alter table deal_companies alter column organization_id drop not null;
alter table deal_people alter column organization_id drop not null;
alter table person_companies alter column organization_id drop not null;
alter table company_domains alter column organization_id drop not null;
alter table person_emails alter column organization_id drop not null;
alter table assistant_conversations alter column organization_id drop not null;
alter table email_messages alter column organization_id drop not null;
alter table email_accounts alter column organization_id drop not null;
alter table tags alter column organization_id drop not null;
alter table activities alter column organization_id drop not null;
alter table todos alter column organization_id drop not null;
alter table deals alter column organization_id drop not null;
alter table companies alter column organization_id drop not null;
alter table people alter column organization_id drop not null;
alter table workspaces alter column organization_id drop not null;

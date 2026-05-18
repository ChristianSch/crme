create table person_emails (
  person_id uuid not null references people(id) on delete cascade,
  email text not null,
  label text not null default '',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (person_id, email)
);
create unique index person_emails_email_unique on person_emails (lower(email));
insert into person_emails (person_id, email, is_primary)
select id, email, true from people where email <> ''
on conflict do nothing;

create table company_domains (
  company_id uuid not null references companies(id) on delete cascade,
  domain text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (company_id, domain)
);
create unique index company_domains_domain_unique on company_domains (lower(domain));
insert into company_domains (company_id, domain, is_primary)
select id, domain, true from companies where domain <> ''
on conflict do nothing;

create table suggestion_suppressions (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  value text not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique (kind, value)
);

---- create above / drop below ----

drop table if exists suggestion_suppressions;
drop index if exists company_domains_domain_unique;
drop table if exists company_domains;
drop index if exists person_emails_email_unique;
drop table if exists person_emails;

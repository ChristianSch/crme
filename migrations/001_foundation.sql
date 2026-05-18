create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table magic_links (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index magic_links_email_idx on magic_links (email);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table people (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index people_email_unique on people (lower(email)) where email <> '';
create index people_search_trgm on people using gin ((first_name || ' ' || last_name || ' ' || email) gin_trgm_ops);

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index companies_domain_unique on companies (lower(domain)) where domain <> '';
create index companies_search_trgm on companies using gin ((name || ' ' || domain) gin_trgm_ops);

create table person_companies (
  person_id uuid not null references people(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role text not null default '',
  primary key (person_id, company_id)
);

create table deals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stage text not null default 'new',
  value_cents bigint not null default 0,
  currency char(3) not null default 'USD',
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deals_stage_idx on deals (stage, stage_changed_at);

create table deal_people (
  deal_id uuid not null references deals(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  primary key (deal_id, person_id)
);
create table deal_companies (
  deal_id uuid not null references deals(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  primary key (deal_id, company_id)
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('note','call','meeting','email')),
  body text not null default '',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table activity_links (
  activity_id uuid not null references activities(id) on delete cascade,
  entity_type text not null check (entity_type in ('person','company','deal')),
  entity_id uuid not null,
  primary key (activity_id, entity_type, entity_id)
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '',
  created_at timestamptz not null default now()
);
create table entity_tags (
  tag_id uuid not null references tags(id) on delete cascade,
  entity_type text not null check (entity_type in ('person','company','deal')),
  entity_id uuid not null,
  primary key (tag_id, entity_type, entity_id)
);

create table todos (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('person','company','deal')),
  entity_id uuid not null,
  title text not null,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index todos_dashboard_idx on todos (status, due_at nulls last, created_at desc);

create table email_messages (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  thread_key text not null,
  direction text not null check (direction in ('inbound','outbound')),
  from_email text not null,
  to_emails text[] not null default '{}',
  subject text not null default '',
  body_text text not null default '',
  sent_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index email_from_idx on email_messages (lower(from_email));
create index email_thread_idx on email_messages (thread_key, sent_at);

create table ai_prompts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  entity_type text not null default '',
  entity_id uuid,
  title text not null,
  body text not null default '',
  status text not null default 'open' check (status in ('open','accepted','dismissed')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index ai_prompts_open_idx on ai_prompts (status, created_at desc);

---- create above / drop below ----

drop table if exists ai_prompts;
drop table if exists email_messages;
drop table if exists todos;
drop table if exists entity_tags;
drop table if exists tags;
drop table if exists activity_links;
drop table if exists activities;
drop table if exists deal_companies;
drop table if exists deal_people;
drop table if exists deals;
drop table if exists person_companies;
drop table if exists companies;
drop table if exists people;
drop table if exists sessions;
drop table if exists magic_links;
drop extension if exists pg_trgm;
drop extension if exists pgcrypto;

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_people (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, person_id)
);
create index workspace_people_person_idx on workspace_people (person_id);

create table workspace_companies (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, company_id)
);
create index workspace_companies_company_idx on workspace_companies (company_id);

alter table deals add column workspace_id uuid references workspaces(id) on delete set null;
create index deals_workspace_idx on deals (workspace_id, updated_at desc);

alter table todos add column workspace_id uuid references workspaces(id) on delete set null;
create index todos_workspace_idx on todos (workspace_id, status, due_at nulls last, created_at desc);

---- create above / drop below ----

drop index if exists todos_workspace_idx;
alter table todos drop column if exists workspace_id;
drop index if exists deals_workspace_idx;
alter table deals drop column if exists workspace_id;
drop table if exists workspace_companies;
drop table if exists workspace_people;
drop table if exists workspaces;

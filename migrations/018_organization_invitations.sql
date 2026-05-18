create table organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','member','viewer')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index organization_invitations_organization_idx on organization_invitations (organization_id, created_at desc);
create index organization_invitations_email_idx on organization_invitations (lower(email));

---- create above / drop below ----

drop index if exists organization_invitations_email_idx;
drop index if exists organization_invitations_organization_idx;
drop table if exists organization_invitations;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null default 'owner',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index users_email_unique on users (lower(email));

alter table sessions add column user_id uuid references users(id) on delete cascade;
alter table sessions add column revoked_at timestamptz;
alter table sessions add column last_seen_at timestamptz;
create index sessions_user_idx on sessions (user_id, expires_at desc);

---- create above / drop below ----

drop index if exists sessions_user_idx;
alter table sessions drop column if exists last_seen_at;
alter table sessions drop column if exists revoked_at;
alter table sessions drop column if exists user_id;
drop table if exists users;

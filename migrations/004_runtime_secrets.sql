create table runtime_secrets (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  name text not null,
  ciphertext bytea not null,
  nonce bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index runtime_secrets_scope_name_idx on runtime_secrets (scope, name);

---- create above / drop below ----

drop table if exists runtime_secrets;

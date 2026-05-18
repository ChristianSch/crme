create table assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  title text not null default '',
  messages jsonb not null default '[]'::jsonb,
  pending_action jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assistant_conversations_session_updated_idx on assistant_conversations (session_id, updated_at desc);

---- create above / drop below ----

drop table if exists assistant_conversations;

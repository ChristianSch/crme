create table email_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null,
  imap_host text not null default '',
  imap_port integer not null default 993,
  imap_username text not null default '',
  smtp_host text not null default '',
  smtp_port integer not null default 587,
  smtp_username text not null default '',
  secret_ref text not null default '',
  sync_enabled boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index email_accounts_email_unique on email_accounts (lower(email));

alter table email_messages add column email_account_id uuid references email_accounts(id) on delete set null;
create index email_messages_account_idx on email_messages (email_account_id, sent_at desc);

---- create above / drop below ----

drop index if exists email_messages_account_idx;
alter table email_messages drop column if exists email_account_id;
drop table if exists email_accounts;

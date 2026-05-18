alter table sessions add column token_hash text;
create unique index sessions_token_hash_unique on sessions (token_hash) where token_hash is not null;

---- create above / drop below ----

drop index if exists sessions_token_hash_unique;
alter table sessions drop column if exists token_hash;

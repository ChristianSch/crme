alter table assistant_conversations drop constraint if exists assistant_conversations_session_id_fkey;
alter table assistant_conversations alter column session_id type text using session_id::text;

---- create above / drop below ----

alter table assistant_conversations alter column session_id type uuid using session_id::uuid;
alter table assistant_conversations add constraint assistant_conversations_session_id_fkey foreign key (session_id) references sessions(id) on delete cascade;

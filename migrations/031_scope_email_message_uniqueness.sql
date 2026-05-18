alter table email_messages drop constraint if exists email_messages_message_id_key;
drop index if exists email_messages_message_id_key;
create unique index email_messages_organization_message_id_unique on email_messages (organization_id, message_id);

---- create above / drop below ----

drop index if exists email_messages_organization_message_id_unique;
alter table email_messages add constraint email_messages_message_id_key unique (message_id);

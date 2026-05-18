alter table email_messages add column activity_id uuid references activities(id) on delete set null;
create index email_messages_activity_idx on email_messages (activity_id);

alter table people add column last_touch_at timestamptz;
create index people_last_touch_idx on people (last_touch_at desc nulls last);

alter table companies add column last_touch_at timestamptz;
create index companies_last_touch_idx on companies (last_touch_at desc nulls last);

---- create above / drop below ----

drop index if exists companies_last_touch_idx;
alter table companies drop column if exists last_touch_at;

drop index if exists people_last_touch_idx;
alter table people drop column if exists last_touch_at;

drop index if exists email_messages_activity_idx;
alter table email_messages drop column if exists activity_id;

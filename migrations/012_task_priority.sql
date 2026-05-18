alter table todos add column priority text not null default 'normal' check (priority in ('low','normal','high','urgent'));
create index todos_priority_idx on todos (priority, status, due_at nulls last, created_at desc);

---- create above / drop below ----

drop index if exists todos_priority_idx;
alter table todos drop column if exists priority;

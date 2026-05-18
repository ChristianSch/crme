alter table people add column city text not null default '';
alter table people add column status text not null default '';
alter table people add column source text not null default '';
alter table people add column my_turn boolean not null default false;

alter table todos add column body text not null default '';
alter table todos alter column title set default '';
alter table todos alter column entity_type drop not null;
alter table todos alter column entity_id drop not null;

---- create above / drop below ----

alter table todos alter column entity_id set not null;
alter table todos alter column entity_type set not null;
alter table todos alter column title drop default;
alter table todos drop column if exists body;

alter table people drop column if exists my_turn;
alter table people drop column if exists source;
alter table people drop column if exists status;
alter table people drop column if exists city;

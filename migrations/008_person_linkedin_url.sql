alter table people add column linkedin_url text not null default '';

---- create above / drop below ----

alter table people drop column if exists linkedin_url;

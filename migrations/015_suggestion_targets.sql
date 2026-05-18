alter table ai_prompts add column target_type text not null default '';
alter table ai_prompts add column target_identifier text not null default '';

update ai_prompts
set target_type = case
    when kind = 'new_contact' then 'email'
    when kind = 'new_company' then 'domain'
    else ''
  end,
  target_identifier = case
    when kind = 'new_contact' then lower(coalesce(substring(title || E'\n' || body from '[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}'), ''))
    when kind = 'new_company' then lower(trim(regexp_replace(title, '^New company:\s*', '', 'i')))
    else ''
  end
where target_identifier = '';

create index ai_prompts_target_idx on ai_prompts (kind, target_type, target_identifier);

alter table suggestion_suppressions add column target_type text not null default '';
alter table suggestion_suppressions add column target_identifier text not null default '';

update suggestion_suppressions
set target_type = case
    when kind = 'new_contact' then 'email'
    when kind = 'new_company' then 'domain'
    else 'value'
  end,
  target_identifier = lower(value)
where target_identifier = '';

create unique index suggestion_suppressions_target_unique on suggestion_suppressions (kind, target_type, target_identifier);

---- create above / drop below ----

drop index if exists suggestion_suppressions_target_unique;
alter table suggestion_suppressions drop column if exists target_identifier;
alter table suggestion_suppressions drop column if exists target_type;

drop index if exists ai_prompts_target_idx;
alter table ai_prompts drop column if exists target_identifier;
alter table ai_prompts drop column if exists target_type;

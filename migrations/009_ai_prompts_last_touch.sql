alter table ai_prompts add column last_touch_at timestamptz;
create index ai_prompts_last_touch_idx on ai_prompts (status, last_touch_at desc nulls last, created_at desc);

---- create above / drop below ----

drop index if exists ai_prompts_last_touch_idx;
alter table ai_prompts drop column if exists last_touch_at;

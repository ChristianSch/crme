update ai_prompts set organization_id = (select id from organizations order by created_at asc, id asc limit 1) where organization_id is null;
update suggestion_suppressions set organization_id = (select id from organizations order by created_at asc, id asc limit 1) where organization_id is null;
alter table ai_prompts alter column organization_id set not null;
alter table suggestion_suppressions alter column organization_id set not null;

alter table person_companies enable row level security;
alter table person_companies force row level security;
create policy person_companies_org_select on person_companies for select using (organization_id::text = current_setting('app.organization_id', true));
create policy person_companies_org_insert on person_companies for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy person_companies_org_update on person_companies for update using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member')) with check (organization_id::text = current_setting('app.organization_id', true));
create policy person_companies_org_delete on person_companies for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table deal_people enable row level security;
alter table deal_people force row level security;
create policy deal_people_org_select on deal_people for select using (organization_id::text = current_setting('app.organization_id', true));
create policy deal_people_org_insert on deal_people for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy deal_people_org_delete on deal_people for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table deal_companies enable row level security;
alter table deal_companies force row level security;
create policy deal_companies_org_select on deal_companies for select using (organization_id::text = current_setting('app.organization_id', true));
create policy deal_companies_org_insert on deal_companies for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy deal_companies_org_delete on deal_companies for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table workspace_people enable row level security;
alter table workspace_people force row level security;
create policy workspace_people_org_select on workspace_people for select using (organization_id::text = current_setting('app.organization_id', true));
create policy workspace_people_org_insert on workspace_people for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy workspace_people_org_delete on workspace_people for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table workspace_companies enable row level security;
alter table workspace_companies force row level security;
create policy workspace_companies_org_select on workspace_companies for select using (organization_id::text = current_setting('app.organization_id', true));
create policy workspace_companies_org_insert on workspace_companies for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy workspace_companies_org_delete on workspace_companies for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table entity_tags enable row level security;
alter table entity_tags force row level security;
create policy entity_tags_org_select on entity_tags for select using (organization_id::text = current_setting('app.organization_id', true));
create policy entity_tags_org_insert on entity_tags for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy entity_tags_org_delete on entity_tags for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table activity_links enable row level security;
alter table activity_links force row level security;
create policy activity_links_org_select on activity_links for select using (organization_id::text = current_setting('app.organization_id', true));
create policy activity_links_org_insert on activity_links for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy activity_links_org_delete on activity_links for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table activities enable row level security;
alter table activities force row level security;
create policy activities_org_select on activities for select using (organization_id::text = current_setting('app.organization_id', true));
create policy activities_org_insert on activities for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy activities_org_update on activities for update using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member')) with check (organization_id::text = current_setting('app.organization_id', true));
create policy activities_org_delete on activities for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table ai_prompts enable row level security;
alter table ai_prompts force row level security;
create policy ai_prompts_org_select on ai_prompts for select using (organization_id::text = current_setting('app.organization_id', true));
create policy ai_prompts_org_insert on ai_prompts for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy ai_prompts_org_update on ai_prompts for update using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member')) with check (organization_id::text = current_setting('app.organization_id', true));
create policy ai_prompts_org_delete on ai_prompts for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table suggestion_suppressions enable row level security;
alter table suggestion_suppressions force row level security;
create policy suggestion_suppressions_org_select on suggestion_suppressions for select using (organization_id::text = current_setting('app.organization_id', true));
create policy suggestion_suppressions_org_insert on suggestion_suppressions for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy suggestion_suppressions_org_update on suggestion_suppressions for update using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member')) with check (organization_id::text = current_setting('app.organization_id', true));
create policy suggestion_suppressions_org_delete on suggestion_suppressions for delete using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

alter table assistant_conversations enable row level security;
alter table assistant_conversations force row level security;
create policy assistant_conversations_org_select on assistant_conversations for select using (organization_id::text = current_setting('app.organization_id', true));
create policy assistant_conversations_org_insert on assistant_conversations for insert with check (organization_id::text = current_setting('app.organization_id', true));
create policy assistant_conversations_org_update on assistant_conversations for update using (organization_id::text = current_setting('app.organization_id', true)) with check (organization_id::text = current_setting('app.organization_id', true));
create policy assistant_conversations_org_delete on assistant_conversations for delete using (organization_id::text = current_setting('app.organization_id', true));

-- Background jobs need to enumerate private accounts before switching into each account owner's context.
drop policy if exists email_accounts_owner_select on email_accounts;
create policy email_accounts_owner_select on email_accounts for select using (owner_user_id::text = current_setting('app.user_id', true) or current_setting('app.role', true) = 'system');

---- create above / drop below ----

drop policy if exists email_accounts_owner_select on email_accounts;
create policy email_accounts_owner_select on email_accounts for select using (owner_user_id::text = current_setting('app.user_id', true));

drop policy if exists assistant_conversations_org_delete on assistant_conversations;
drop policy if exists assistant_conversations_org_update on assistant_conversations;
drop policy if exists assistant_conversations_org_insert on assistant_conversations;
drop policy if exists assistant_conversations_org_select on assistant_conversations;
alter table assistant_conversations no force row level security;
alter table assistant_conversations disable row level security;

drop policy if exists suggestion_suppressions_org_delete on suggestion_suppressions;
drop policy if exists suggestion_suppressions_org_update on suggestion_suppressions;
drop policy if exists suggestion_suppressions_org_insert on suggestion_suppressions;
drop policy if exists suggestion_suppressions_org_select on suggestion_suppressions;
alter table suggestion_suppressions no force row level security;
alter table suggestion_suppressions disable row level security;
alter table suggestion_suppressions alter column organization_id drop not null;

drop policy if exists ai_prompts_org_delete on ai_prompts;
drop policy if exists ai_prompts_org_update on ai_prompts;
drop policy if exists ai_prompts_org_insert on ai_prompts;
drop policy if exists ai_prompts_org_select on ai_prompts;
alter table ai_prompts no force row level security;
alter table ai_prompts disable row level security;
alter table ai_prompts alter column organization_id drop not null;

drop policy if exists activities_org_delete on activities;
drop policy if exists activities_org_update on activities;
drop policy if exists activities_org_insert on activities;
drop policy if exists activities_org_select on activities;
alter table activities no force row level security;
alter table activities disable row level security;

drop policy if exists activity_links_org_delete on activity_links;
drop policy if exists activity_links_org_insert on activity_links;
drop policy if exists activity_links_org_select on activity_links;
alter table activity_links no force row level security;
alter table activity_links disable row level security;

drop policy if exists entity_tags_org_delete on entity_tags;
drop policy if exists entity_tags_org_insert on entity_tags;
drop policy if exists entity_tags_org_select on entity_tags;
alter table entity_tags no force row level security;
alter table entity_tags disable row level security;

drop policy if exists workspace_companies_org_delete on workspace_companies;
drop policy if exists workspace_companies_org_insert on workspace_companies;
drop policy if exists workspace_companies_org_select on workspace_companies;
alter table workspace_companies no force row level security;
alter table workspace_companies disable row level security;

drop policy if exists workspace_people_org_delete on workspace_people;
drop policy if exists workspace_people_org_insert on workspace_people;
drop policy if exists workspace_people_org_select on workspace_people;
alter table workspace_people no force row level security;
alter table workspace_people disable row level security;

drop policy if exists deal_companies_org_delete on deal_companies;
drop policy if exists deal_companies_org_insert on deal_companies;
drop policy if exists deal_companies_org_select on deal_companies;
alter table deal_companies no force row level security;
alter table deal_companies disable row level security;

drop policy if exists deal_people_org_delete on deal_people;
drop policy if exists deal_people_org_insert on deal_people;
drop policy if exists deal_people_org_select on deal_people;
alter table deal_people no force row level security;
alter table deal_people disable row level security;

drop policy if exists person_companies_org_delete on person_companies;
drop policy if exists person_companies_org_update on person_companies;
drop policy if exists person_companies_org_insert on person_companies;
drop policy if exists person_companies_org_select on person_companies;
alter table person_companies no force row level security;
alter table person_companies disable row level security;

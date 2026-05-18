drop policy if exists person_companies_org_insert on person_companies;
drop policy if exists person_companies_org_update on person_companies;
create policy person_companies_org_insert on person_companies for insert with check (
  organization_id::text = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('owner','admin','member')
  and exists (select 1 from people p where p.id = person_id and p.organization_id = person_companies.organization_id)
  and exists (select 1 from companies c where c.id = company_id and c.organization_id = person_companies.organization_id)
);
create policy person_companies_org_update on person_companies for update using (
  organization_id::text = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('owner','admin','member')
) with check (
  organization_id::text = current_setting('app.organization_id', true)
  and exists (select 1 from people p where p.id = person_id and p.organization_id = person_companies.organization_id)
  and exists (select 1 from companies c where c.id = company_id and c.organization_id = person_companies.organization_id)
);

drop policy if exists deal_people_org_insert on deal_people;
create policy deal_people_org_insert on deal_people for insert with check (
  organization_id::text = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('owner','admin','member')
  and exists (select 1 from deals d where d.id = deal_id and d.organization_id = deal_people.organization_id)
  and exists (select 1 from people p where p.id = person_id and p.organization_id = deal_people.organization_id)
);

drop policy if exists deal_companies_org_insert on deal_companies;
create policy deal_companies_org_insert on deal_companies for insert with check (
  organization_id::text = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('owner','admin','member')
  and exists (select 1 from deals d where d.id = deal_id and d.organization_id = deal_companies.organization_id)
  and exists (select 1 from companies c where c.id = company_id and c.organization_id = deal_companies.organization_id)
);

drop policy if exists workspace_people_org_insert on workspace_people;
create policy workspace_people_org_insert on workspace_people for insert with check (
  organization_id::text = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('owner','admin','member')
  and exists (select 1 from workspaces w where w.id = workspace_id and w.organization_id = workspace_people.organization_id)
  and exists (select 1 from people p where p.id = person_id and p.organization_id = workspace_people.organization_id)
);

drop policy if exists workspace_companies_org_insert on workspace_companies;
create policy workspace_companies_org_insert on workspace_companies for insert with check (
  organization_id::text = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('owner','admin','member')
  and exists (select 1 from workspaces w where w.id = workspace_id and w.organization_id = workspace_companies.organization_id)
  and exists (select 1 from companies c where c.id = company_id and c.organization_id = workspace_companies.organization_id)
);

drop policy if exists entity_tags_org_insert on entity_tags;
create policy entity_tags_org_insert on entity_tags for insert with check (
  organization_id::text = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('owner','admin','member')
  and exists (select 1 from tags t where t.id = tag_id and t.organization_id = entity_tags.organization_id)
  and (
    (entity_type = 'person' and exists (select 1 from people p where p.id = entity_id and p.organization_id = entity_tags.organization_id))
    or (entity_type = 'company' and exists (select 1 from companies c where c.id = entity_id and c.organization_id = entity_tags.organization_id))
    or (entity_type = 'deal' and exists (select 1 from deals d where d.id = entity_id and d.organization_id = entity_tags.organization_id))
  )
);

drop policy if exists activity_links_org_insert on activity_links;
create policy activity_links_org_insert on activity_links for insert with check (
  organization_id::text = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('owner','admin','member')
  and exists (select 1 from activities a where a.id = activity_id and a.organization_id = activity_links.organization_id)
  and (
    (entity_type = 'person' and exists (select 1 from people p where p.id = entity_id and p.organization_id = activity_links.organization_id))
    or (entity_type = 'company' and exists (select 1 from companies c where c.id = entity_id and c.organization_id = activity_links.organization_id))
    or (entity_type = 'deal' and exists (select 1 from deals d where d.id = entity_id and d.organization_id = activity_links.organization_id))
  )
);

---- create above / drop below ----

drop policy if exists activity_links_org_insert on activity_links;
create policy activity_links_org_insert on activity_links for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

drop policy if exists entity_tags_org_insert on entity_tags;
create policy entity_tags_org_insert on entity_tags for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

drop policy if exists workspace_companies_org_insert on workspace_companies;
create policy workspace_companies_org_insert on workspace_companies for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

drop policy if exists workspace_people_org_insert on workspace_people;
create policy workspace_people_org_insert on workspace_people for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

drop policy if exists deal_companies_org_insert on deal_companies;
create policy deal_companies_org_insert on deal_companies for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

drop policy if exists deal_people_org_insert on deal_people;
create policy deal_people_org_insert on deal_people for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));

drop policy if exists person_companies_org_update on person_companies;
drop policy if exists person_companies_org_insert on person_companies;
create policy person_companies_org_insert on person_companies for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member'));
create policy person_companies_org_update on person_companies for update using (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member')) with check (organization_id::text = current_setting('app.organization_id', true));

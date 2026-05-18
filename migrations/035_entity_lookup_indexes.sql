create index people_organization_updated_id_idx on people (organization_id, updated_at desc, id desc);
create index companies_organization_updated_id_idx on companies (organization_id, updated_at desc, id desc);
create index deals_organization_updated_id_idx on deals (organization_id, updated_at desc, id desc);

create index todos_entity_lookup_idx on todos (organization_id, entity_type, entity_id, created_at desc);
create index activity_links_entity_lookup_idx on activity_links (organization_id, entity_type, entity_id, activity_id);

create index person_companies_organization_person_idx on person_companies (organization_id, person_id, company_id);
create index person_companies_organization_company_idx on person_companies (organization_id, company_id, person_id);
create index deal_people_organization_deal_idx on deal_people (organization_id, deal_id, person_id);
create index deal_companies_organization_deal_idx on deal_companies (organization_id, deal_id, company_id);
create index workspace_people_organization_workspace_idx on workspace_people (organization_id, workspace_id, person_id);
create index workspace_companies_organization_workspace_idx on workspace_companies (organization_id, workspace_id, company_id);

---- create above / drop below ----

drop index if exists workspace_companies_organization_workspace_idx;
drop index if exists workspace_people_organization_workspace_idx;
drop index if exists deal_companies_organization_deal_idx;
drop index if exists deal_people_organization_deal_idx;
drop index if exists person_companies_organization_company_idx;
drop index if exists person_companies_organization_person_idx;
drop index if exists activity_links_entity_lookup_idx;
drop index if exists todos_entity_lookup_idx;
drop index if exists deals_organization_updated_id_idx;
drop index if exists companies_organization_updated_id_idx;
drop index if exists people_organization_updated_id_idx;

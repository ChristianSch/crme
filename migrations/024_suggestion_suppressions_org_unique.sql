drop index if exists suggestion_suppressions_target_unique;
create unique index suggestion_suppressions_organization_target_unique on suggestion_suppressions (organization_id, kind, target_type, target_identifier);

---- create above / drop below ----

drop index if exists suggestion_suppressions_organization_target_unique;
create unique index suggestion_suppressions_target_unique on suggestion_suppressions (kind, target_type, target_identifier);

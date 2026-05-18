drop policy if exists audit_logs_org_insert on audit_logs;
create policy audit_logs_org_insert on audit_logs for insert with check (organization_id::text = current_setting('app.organization_id', true) and (actor_user_id::text = current_setting('app.user_id', true) or actor_user_id is null) and current_setting('app.role', true) in ('owner','admin','member','viewer'));

---- create above / drop below ----

drop policy if exists audit_logs_org_insert on audit_logs;
create policy audit_logs_org_insert on audit_logs for insert with check (organization_id::text = current_setting('app.organization_id', true) and current_setting('app.role', true) in ('owner','admin','member','viewer'));

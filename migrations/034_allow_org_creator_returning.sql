create policy organizations_creator_select on organizations for select using (current_setting('app.role', true) = 'org_creator');
create policy organizations_creator_insert on organizations for insert with check (current_setting('app.role', true) = 'org_creator' and current_setting('app.user_id', true) <> '');

---- create above / drop below ----

drop policy if exists organizations_creator_insert on organizations;
drop policy if exists organizations_creator_select on organizations;

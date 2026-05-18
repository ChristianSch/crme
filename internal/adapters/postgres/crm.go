package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"crme/internal/domain"
)

func (s *Store) CreatePerson(ctx context.Context, p domain.Person) (domain.Person, error) {
	err := s.queryRow(ctx, `insert into people (organization_id,first_name,last_name,email,phone,title,linkedin_url,city,status,source,my_turn,last_touch_at) values ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id, created_at, updated_at`, organizationID(ctx), p.FirstName, p.LastName, p.Email, p.Phone, p.Title, p.LinkedInURL, p.City, p.Status, p.Source, p.MyTurn, p.LastTouchAt).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
	return p, err
}
func (s *Store) GetPerson(ctx context.Context, id domain.ID) (domain.Person, error) {
	var p domain.Person
	err := s.queryRow(ctx, `select p.id, p.first_name, p.last_name, p.email, p.phone, p.title, p.linkedin_url, p.city, coalesce(pc.company_name,''), p.status, p.source, p.my_turn, p.last_touch_at, p.created_at, p.updated_at from people p left join lateral (select c.name as company_name from person_companies pc join companies c on c.id=pc.company_id where pc.person_id=p.id order by c.updated_at desc limit 1) pc on true where p.id=$1 and p.organization_id=$2::uuid`, id, organizationID(ctx)).Scan(&p.ID, &p.FirstName, &p.LastName, &p.Email, &p.Phone, &p.Title, &p.LinkedInURL, &p.City, &p.CompanyName, &p.Status, &p.Source, &p.MyTurn, &p.LastTouchAt, &p.CreatedAt, &p.UpdatedAt)
	return p, err
}
func (s *Store) UpdatePerson(ctx context.Context, p domain.Person) (domain.Person, error) {
	err := s.queryRow(ctx, `update people set first_name=$3,last_name=$4,email=$5,phone=$6,title=$7,linkedin_url=$8,city=$9,status=$10,source=$11,my_turn=$12,last_touch_at=$13,updated_at=now() where id=$1 and organization_id=$2::uuid returning created_at, updated_at`, p.ID, organizationID(ctx), p.FirstName, p.LastName, p.Email, p.Phone, p.Title, p.LinkedInURL, p.City, p.Status, p.Source, p.MyTurn, p.LastTouchAt).Scan(&p.CreatedAt, &p.UpdatedAt)
	return p, err
}
func (s *Store) DeletePerson(ctx context.Context, id domain.ID) error {
	tx, err := s.begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	orgID := organizationID(ctx)
	if _, err := tx.Exec(ctx, `delete from todos where entity_type='person' and entity_id=$1 and organization_id=$2::uuid`, id, orgID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from activity_links where entity_type='person' and entity_id=$1 and organization_id=$2::uuid`, id, orgID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from entity_tags where entity_type='person' and entity_id=$1 and organization_id=$2::uuid`, id, orgID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from people where id=$1 and organization_id=$2::uuid`, id, orgID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *Store) ListPeople(ctx context.Context, query string, workspaceID domain.ID, limit, offset int) ([]domain.Person, error) {
	rows, err := s.query(ctx, `select p.id, p.first_name, p.last_name, p.email, p.phone, p.title, p.linkedin_url, p.city, coalesce(pc.company_name,''), p.status, p.source, p.my_turn, p.last_touch_at, p.created_at, p.updated_at from people p left join lateral (select c.name as company_name from person_companies pc join companies c on c.id=pc.company_id where pc.person_id=p.id order by c.updated_at desc limit 1) pc on true where ($1='' or p.first_name ilike '%'||$1||'%' or p.last_name ilike '%'||$1||'%' or p.email ilike '%'||$1||'%' or p.linkedin_url ilike '%'||$1||'%') and ($2='' or exists (select 1 from workspace_people wp where wp.person_id=p.id and wp.workspace_id=$2::uuid)) and p.organization_id=$5::uuid order by p.updated_at desc, p.id desc limit $3 offset $4`, query, workspaceID, limit, offset, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Person
	for rows.Next() {
		var p domain.Person
		if err := rows.Scan(&p.ID, &p.FirstName, &p.LastName, &p.Email, &p.Phone, &p.Title, &p.LinkedInURL, &p.City, &p.CompanyName, &p.Status, &p.Source, &p.MyTurn, &p.LastTouchAt, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
func (s *Store) FindPersonByEmail(ctx context.Context, email string) (domain.Person, bool, error) {
	var p domain.Person
	err := s.queryRow(ctx, `select p.id, p.first_name, p.last_name, p.email, p.phone, p.title, p.linkedin_url, p.city, p.status, p.source, p.my_turn, p.last_touch_at, p.created_at, p.updated_at from people p left join person_emails pe on pe.person_id=p.id where p.organization_id=$2::uuid and (lower(p.email)=lower($1) or lower(pe.email)=lower($1)) limit 1`, email, organizationID(ctx)).Scan(&p.ID, &p.FirstName, &p.LastName, &p.Email, &p.Phone, &p.Title, &p.LinkedInURL, &p.City, &p.Status, &p.Source, &p.MyTurn, &p.LastTouchAt, &p.CreatedAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, false, nil
	}
	if err != nil {
		return p, false, err
	}
	return p, true, nil
}
func (s *Store) AddPersonEmail(ctx context.Context, personID domain.ID, email string, primary bool) error {
	tx, err := s.begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `insert into person_emails (organization_id,person_id,email,is_primary) values ($1::uuid,$2,lower($3),$4) on conflict (person_id,email) do update set is_primary=person_emails.is_primary or excluded.is_primary`, organizationID(ctx), personID, email, primary); err != nil {
		return err
	}
	if primary {
		if _, err := tx.Exec(ctx, `update person_emails set is_primary=(lower(email)=lower($2)) where person_id=$1`, personID, email); err != nil {
			return err
		}
	}
	_, err = tx.Exec(ctx, `update people set email=lower($2), updated_at=now() where id=$1 and organization_id=$4::uuid and (email='' or email is null or $3)`, personID, email, primary, organizationID(ctx))
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *Store) CreateCompany(ctx context.Context, c domain.Company) (domain.Company, error) {
	err := s.queryRow(ctx, `insert into companies (organization_id,name,domain,last_touch_at) values ($1::uuid,$2,$3,$4) returning id, created_at, updated_at`, organizationID(ctx), c.Name, c.Domain, c.LastTouchAt).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
	return c, err
}
func (s *Store) GetCompany(ctx context.Context, id domain.ID) (domain.Company, error) {
	var c domain.Company
	err := s.queryRow(ctx, `select id,name,domain,last_touch_at,created_at,updated_at from companies where id=$1 and organization_id=$2::uuid`, id, organizationID(ctx)).Scan(&c.ID, &c.Name, &c.Domain, &c.LastTouchAt, &c.CreatedAt, &c.UpdatedAt)
	return c, err
}
func (s *Store) UpdateCompany(ctx context.Context, c domain.Company) (domain.Company, error) {
	err := s.queryRow(ctx, `update companies set name=$3,domain=$4,last_touch_at=$5,updated_at=now() where id=$1 and organization_id=$2::uuid returning created_at,updated_at`, c.ID, organizationID(ctx), c.Name, c.Domain, c.LastTouchAt).Scan(&c.CreatedAt, &c.UpdatedAt)
	return c, err
}
func (s *Store) DeleteCompany(ctx context.Context, id domain.ID) error {
	tx, err := s.begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	orgID := organizationID(ctx)
	if _, err := tx.Exec(ctx, `delete from todos where entity_type='company' and entity_id=$1 and organization_id=$2::uuid`, id, orgID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from activity_links where entity_type='company' and entity_id=$1 and organization_id=$2::uuid`, id, orgID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from entity_tags where entity_type='company' and entity_id=$1 and organization_id=$2::uuid`, id, orgID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from companies where id=$1 and organization_id=$2::uuid`, id, orgID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *Store) ListCompanies(ctx context.Context, query string, workspaceID domain.ID, limit, offset int) ([]domain.Company, error) {
	rows, err := s.query(ctx, `select id, name, domain, last_touch_at, created_at, updated_at from companies where ($1='' or name ilike '%'||$1||'%' or domain ilike '%'||$1||'%') and ($2='' or exists (select 1 from workspace_companies wc where wc.company_id=companies.id and wc.workspace_id=$2::uuid)) and organization_id=$5::uuid order by updated_at desc, id desc limit $3 offset $4`, query, workspaceID, limit, offset, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Company
	for rows.Next() {
		var c domain.Company
		if err := rows.Scan(&c.ID, &c.Name, &c.Domain, &c.LastTouchAt, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
func (s *Store) ListCompaniesForPerson(ctx context.Context, personID domain.ID, limit int) ([]domain.Company, error) {
	rows, err := s.query(ctx, `select c.id, c.name, c.domain, c.last_touch_at, c.created_at, c.updated_at from companies c join person_companies pc on pc.company_id=c.id where pc.person_id=$1 and c.organization_id=$3::uuid order by c.updated_at desc limit $2`, personID, limit, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Company
	for rows.Next() {
		var c domain.Company
		if err := rows.Scan(&c.ID, &c.Name, &c.Domain, &c.LastTouchAt, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
func (s *Store) ListPeopleForCompany(ctx context.Context, companyID domain.ID, limit int) ([]domain.Person, error) {
	rows, err := s.query(ctx, `select p.id, p.first_name, p.last_name, p.email, p.phone, p.title, p.linkedin_url, p.city, c.name, p.status, p.source, p.my_turn, p.last_touch_at, p.created_at, p.updated_at from people p join person_companies pc on pc.person_id=p.id join companies c on c.id=pc.company_id where pc.company_id=$1 and p.organization_id=$3::uuid order by p.updated_at desc limit $2`, companyID, limit, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Person
	for rows.Next() {
		var p domain.Person
		if err := rows.Scan(&p.ID, &p.FirstName, &p.LastName, &p.Email, &p.Phone, &p.Title, &p.LinkedInURL, &p.City, &p.CompanyName, &p.Status, &p.Source, &p.MyTurn, &p.LastTouchAt, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
func (s *Store) FindCompanyByDomain(ctx context.Context, domainName string) (domain.Company, bool, error) {
	var c domain.Company
	err := s.queryRow(ctx, `select c.id,c.name,c.domain,c.last_touch_at,c.created_at,c.updated_at from companies c left join company_domains cd on cd.company_id=c.id where c.organization_id=$2::uuid and (lower(c.domain)=lower($1) or lower(cd.domain)=lower($1)) limit 1`, domainName, organizationID(ctx)).Scan(&c.ID, &c.Name, &c.Domain, &c.LastTouchAt, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return c, false, nil
	}
	if err != nil {
		return c, false, err
	}
	return c, true, nil
}
func (s *Store) AddCompanyDomain(ctx context.Context, companyID domain.ID, domainName string, primary bool) error {
	_, err := s.exec(ctx, `insert into company_domains (organization_id,company_id,domain,is_primary) values ($1::uuid,$2,lower($3),$4) on conflict (company_id,domain) do update set is_primary=company_domains.is_primary or excluded.is_primary`, organizationID(ctx), companyID, domainName, primary)
	return err
}
func (s *Store) CreateDeal(ctx context.Context, d domain.Deal) (domain.Deal, error) {
	err := s.queryRow(ctx, `insert into deals (organization_id,workspace_id,name,stage,value_cents,currency) values ($1::uuid,nullif($2,'')::uuid,$3,$4,$5,$6) returning id, created_at, updated_at`, organizationID(ctx), d.WorkspaceID, d.Name, d.Stage, d.ValueCents, d.Currency).Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt)
	return d, err
}
func (s *Store) GetDeal(ctx context.Context, id domain.ID) (domain.Deal, error) {
	var d domain.Deal
	err := s.queryRow(ctx, `select id, coalesce(workspace_id::text,''), name, stage, value_cents, currency, created_at, updated_at from deals where id=$1 and organization_id=$2::uuid`, id, organizationID(ctx)).Scan(&d.ID, &d.WorkspaceID, &d.Name, &d.Stage, &d.ValueCents, &d.Currency, &d.CreatedAt, &d.UpdatedAt)
	return d, err
}
func (s *Store) UpdateDeal(ctx context.Context, d domain.Deal) (domain.Deal, error) {
	err := s.queryRow(ctx, `update deals set workspace_id=nullif($3,'')::uuid,name=$4,stage=$5,value_cents=$6,currency=$7,stage_changed_at=case when stage<>$5 then now() else stage_changed_at end,updated_at=now() where id=$1 and organization_id=$2::uuid returning created_at,updated_at`, d.ID, organizationID(ctx), d.WorkspaceID, d.Name, d.Stage, d.ValueCents, d.Currency).Scan(&d.CreatedAt, &d.UpdatedAt)
	return d, err
}
func (s *Store) DeleteDeal(ctx context.Context, id domain.ID) error {
	tx, err := s.begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	orgID := organizationID(ctx)
	if _, err := tx.Exec(ctx, `delete from todos where entity_type='deal' and entity_id=$1 and organization_id=$2::uuid`, id, orgID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from activity_links where entity_type='deal' and entity_id=$1 and organization_id=$2::uuid`, id, orgID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from entity_tags where entity_type='deal' and entity_id=$1 and organization_id=$2::uuid`, id, orgID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `delete from deals where id=$1 and organization_id=$2::uuid`, id, orgID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *Store) ListDeals(ctx context.Context, query string, workspaceID domain.ID, limit, offset int) ([]domain.Deal, error) {
	rows, err := s.query(ctx, `select d.id, coalesce(d.workspace_id::text,''), d.name, d.stage, d.value_cents, d.currency, d.created_at, d.updated_at from deals d where ($1='' or d.name ilike '%'||$1||'%' or d.stage ilike '%'||$1||'%' or d.currency ilike '%'||$1||'%' or exists (select 1 from deal_people dp join people p on p.id=dp.person_id where dp.deal_id=d.id and (p.first_name ilike '%'||$1||'%' or p.last_name ilike '%'||$1||'%' or p.email ilike '%'||$1||'%')) or exists (select 1 from deal_companies dc join companies c on c.id=dc.company_id where dc.deal_id=d.id and (c.name ilike '%'||$1||'%' or c.domain ilike '%'||$1||'%'))) and ($2='' or d.workspace_id=$2::uuid) and d.organization_id=$5::uuid order by d.updated_at desc, d.id desc limit $3 offset $4`, query, workspaceID, limit, offset, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Deal
	for rows.Next() {
		var d domain.Deal
		if err := rows.Scan(&d.ID, &d.WorkspaceID, &d.Name, &d.Stage, &d.ValueCents, &d.Currency, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
func (s *Store) LinkPersonCompany(ctx context.Context, personID, companyID domain.ID, role string) error {
	_, err := s.exec(ctx, `insert into person_companies (organization_id,person_id,company_id,role) values ($1::uuid,$2,$3,$4) on conflict (person_id,company_id) do update set role=excluded.role`, organizationID(ctx), personID, companyID, role)
	return err
}
func (s *Store) UnlinkPersonCompany(ctx context.Context, personID, companyID domain.ID) error {
	_, err := s.exec(ctx, `delete from person_companies where person_id=$1 and company_id=$2 and organization_id=$3::uuid`, personID, companyID, organizationID(ctx))
	return err
}
func (s *Store) LinkDealPerson(ctx context.Context, dealID, personID domain.ID) error {
	_, err := s.exec(ctx, `insert into deal_people (organization_id,deal_id,person_id) values ($1::uuid,$2,$3) on conflict do nothing`, organizationID(ctx), dealID, personID)
	return err
}
func (s *Store) UnlinkDealPerson(ctx context.Context, dealID, personID domain.ID) error {
	_, err := s.exec(ctx, `delete from deal_people where deal_id=$1 and person_id=$2 and organization_id=$3::uuid`, dealID, personID, organizationID(ctx))
	return err
}
func (s *Store) ListPeopleForDeal(ctx context.Context, dealID domain.ID, limit int) ([]domain.Person, error) {
	rows, err := s.query(ctx, `select p.id, p.first_name, p.last_name, p.email, p.phone, p.title, p.linkedin_url, p.city, coalesce(pc.company_name,''), p.status, p.source, p.my_turn, p.last_touch_at, p.created_at, p.updated_at from people p join deal_people dp on dp.person_id=p.id left join lateral (select c.name as company_name from person_companies pc join companies c on c.id=pc.company_id where pc.person_id=p.id order by c.updated_at desc limit 1) pc on true where dp.deal_id=$1 and p.organization_id=$3::uuid order by p.updated_at desc limit $2`, dealID, limit, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Person
	for rows.Next() {
		var p domain.Person
		if err := rows.Scan(&p.ID, &p.FirstName, &p.LastName, &p.Email, &p.Phone, &p.Title, &p.LinkedInURL, &p.City, &p.CompanyName, &p.Status, &p.Source, &p.MyTurn, &p.LastTouchAt, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
func (s *Store) LinkDealCompany(ctx context.Context, dealID, companyID domain.ID) error {
	_, err := s.exec(ctx, `insert into deal_companies (organization_id,deal_id,company_id) values ($1::uuid,$2,$3) on conflict do nothing`, organizationID(ctx), dealID, companyID)
	return err
}
func (s *Store) UnlinkDealCompany(ctx context.Context, dealID, companyID domain.ID) error {
	_, err := s.exec(ctx, `delete from deal_companies where deal_id=$1 and company_id=$2 and organization_id=$3::uuid`, dealID, companyID, organizationID(ctx))
	return err
}
func (s *Store) ListCompaniesForDeal(ctx context.Context, dealID domain.ID, limit int) ([]domain.Company, error) {
	rows, err := s.query(ctx, `select c.id, c.name, c.domain, c.last_touch_at, c.created_at, c.updated_at from companies c join deal_companies dc on dc.company_id=c.id where dc.deal_id=$1 and c.organization_id=$3::uuid order by c.updated_at desc limit $2`, dealID, limit, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Company
	for rows.Next() {
		var c domain.Company
		if err := rows.Scan(&c.ID, &c.Name, &c.Domain, &c.LastTouchAt, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
func (s *Store) LinkActivity(ctx context.Context, activityID domain.ID, entityType domain.EntityType, entityID domain.ID) error {
	_, err := s.exec(ctx, `insert into activity_links (organization_id,activity_id,entity_type,entity_id) values ($1::uuid,$2,$3,$4) on conflict do nothing`, organizationID(ctx), activityID, entityType, entityID)
	return err
}
func (s *Store) CreateActivityDetail(ctx context.Context, detail domain.ActivityDetail) error {
	_, err := s.exec(ctx, `insert into activity_details (activity_id,owner_user_id,body_text) values ($1,$2,$3) on conflict (activity_id) do update set body_text=excluded.body_text`, detail.ActivityID, detail.OwnerUserID, detail.BodyText)
	return err
}

func (s *Store) GetActivity(ctx context.Context, id domain.ID) (domain.Activity, error) {
	var a domain.Activity
	err := s.queryRow(ctx, `select id,type,body,occurred_at,created_at from activities where id=$1 and organization_id=$2::uuid`, id, organizationID(ctx)).Scan(&a.ID, &a.Type, &a.Body, &a.OccurredAt, &a.CreatedAt)
	return a, err
}
func (s *Store) UpdateActivity(ctx context.Context, a domain.Activity) (domain.Activity, error) {
	err := s.queryRow(ctx, `update activities set type=$3, body=$4, occurred_at=$5 where id=$1 and organization_id=$2::uuid returning created_at`, a.ID, organizationID(ctx), a.Type, a.Body, a.OccurredAt).Scan(&a.CreatedAt)
	return a, err
}
func (s *Store) DeleteActivity(ctx context.Context, id domain.ID) error {
	_, err := s.exec(ctx, `delete from activities where id=$1 and organization_id=$2::uuid`, id, organizationID(ctx))
	return err
}
func (s *Store) CreateActivity(ctx context.Context, a domain.Activity, links []domain.ActivityLink) (domain.Activity, error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return a, err
	}
	defer tx.Rollback(ctx)
	if a.OccurredAt.IsZero() {
		a.OccurredAt = time.Now().UTC()
	}
	orgID := organizationID(ctx)
	if err := tx.QueryRow(ctx, `insert into activities (organization_id,type,body,occurred_at) values ($1::uuid,$2,$3,$4) returning id,created_at`, orgID, a.Type, a.Body, a.OccurredAt).Scan(&a.ID, &a.CreatedAt); err != nil {
		return a, err
	}
	for _, l := range links {
		if _, err := tx.Exec(ctx, `insert into activity_links (organization_id,activity_id,entity_type,entity_id) values ($1::uuid,$2,$3,$4) on conflict do nothing`, orgID, a.ID, l.EntityType, l.EntityID); err != nil {
			return a, err
		}
	}
	return a, tx.Commit(ctx)
}
func (s *Store) ListNotes(ctx context.Context, limit int) ([]domain.TimelineItem, error) {
	rows, err := s.query(ctx, `select 'note', a.id, coalesce(al.entity_type,''), coalesce(al.entity_id::text,''), a.type, coalesce(nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''), c.name, d.name, ''), a.body, a.occurred_at from activities a left join lateral (select entity_type, entity_id from activity_links where activity_id=a.id order by case entity_type when 'person' then 0 when 'company' then 1 when 'deal' then 2 else 3 end limit 1) al on true left join people p on al.entity_type='person' and p.id=al.entity_id left join companies c on al.entity_type='company' and c.id=al.entity_id left join deals d on al.entity_type='deal' and d.id=al.entity_id where a.type='note' and a.organization_id=$2::uuid order by a.occurred_at desc limit $1`, limit, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.TimelineItem
	for rows.Next() {
		var item domain.TimelineItem
		if err := rows.Scan(&item.Kind, &item.ID, &item.EntityType, &item.EntityID, &item.Type, &item.Title, &item.Body, &item.At); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (s *Store) ListTimeline(ctx context.Context, entityType domain.EntityType, entityID domain.ID, limit int) ([]domain.TimelineItem, error) {
	rows, err := s.query(ctx, `select 'activity', a.id, al.entity_type, al.entity_id, a.type, '', a.body, coalesce(ad.body_text,''), a.type='email', ad.activity_id is not null, a.occurred_at from activities a join activity_links al on al.activity_id=a.id left join activity_details ad on ad.activity_id=a.id where al.entity_type=$1 and al.entity_id=$2 and a.organization_id=$4::uuid union all select 'todo', id, entity_type, entity_id, ''::text, title, body, ''::text, false, false, created_at from todos where entity_type=$1 and entity_id=$2 and organization_id=$4::uuid order by 11 desc limit $3`, entityType, entityID, limit, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.TimelineItem
	for rows.Next() {
		var i domain.TimelineItem
		if err := rows.Scan(&i.Kind, &i.ID, &i.EntityType, &i.EntityID, &i.Type, &i.Title, &i.Body, &i.PrivateBody, &i.PrivateDetail, &i.PrivateDetailOwn, &i.At); err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}
func (s *Store) CreateTag(ctx context.Context, tag domain.Tag) (domain.Tag, error) {
	err := s.queryRow(ctx, `insert into tags (organization_id,name,color) values ($1::uuid,$2,$3) on conflict (organization_id, (lower(name))) do update set color=excluded.color returning id,created_at`, organizationID(ctx), tag.Name, tag.Color).Scan(&tag.ID, &tag.CreatedAt)
	return tag, err
}
func (s *Store) ListTags(ctx context.Context, limit int) ([]domain.Tag, error) {
	rows, err := s.query(ctx, `select id,name,color,created_at from tags where organization_id=$2::uuid order by name limit $1`, limit, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Tag
	for rows.Next() {
		var t domain.Tag
		if err := rows.Scan(&t.ID, &t.Name, &t.Color, &t.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
func (s *Store) TagEntity(ctx context.Context, tagID domain.ID, entityType domain.EntityType, entityID domain.ID) error {
	_, err := s.exec(ctx, `insert into entity_tags (organization_id,tag_id,entity_type,entity_id) values ($1::uuid,$2,$3,$4) on conflict do nothing`, organizationID(ctx), tagID, entityType, entityID)
	return err
}
func (s *Store) CreateWorkspace(ctx context.Context, workspace domain.Workspace) (domain.Workspace, error) {
	err := s.queryRow(ctx, `insert into workspaces (organization_id,name,description) values ($1::uuid,$2,$3) returning id,created_at,updated_at`, organizationID(ctx), workspace.Name, workspace.Description).Scan(&workspace.ID, &workspace.CreatedAt, &workspace.UpdatedAt)
	return workspace, err
}
func (s *Store) ListWorkspaces(ctx context.Context, limit int) ([]domain.Workspace, error) {
	rows, err := s.query(ctx, `select id,name,description,created_at,updated_at from workspaces where organization_id=$2::uuid order by updated_at desc limit $1`, limit, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Workspace
	for rows.Next() {
		var w domain.Workspace
		if err := rows.Scan(&w.ID, &w.Name, &w.Description, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}
func (s *Store) LinkWorkspaceEntity(ctx context.Context, workspaceID domain.ID, entityType domain.EntityType, entityID domain.ID) error {
	switch entityType {
	case domain.EntityPerson:
		_, err := s.exec(ctx, `insert into workspace_people (organization_id,workspace_id,person_id) values ($1::uuid,$2,$3) on conflict do nothing`, organizationID(ctx), workspaceID, entityID)
		return err
	case domain.EntityCompany:
		_, err := s.exec(ctx, `insert into workspace_companies (organization_id,workspace_id,company_id) values ($1::uuid,$2,$3) on conflict do nothing`, organizationID(ctx), workspaceID, entityID)
		return err
	case domain.EntityDeal:
		ct, err := s.exec(ctx, `update deals set workspace_id=$1, updated_at=now() where id=$2 and organization_id=$3::uuid`, workspaceID, entityID, organizationID(ctx))
		if err == nil && ct.RowsAffected() == 0 {
			return pgx.ErrNoRows
		}
		return err
	case domain.EntityTodo:
		ct, err := s.exec(ctx, `update todos set workspace_id=$1 where id=$2 and organization_id=$3::uuid`, workspaceID, entityID, organizationID(ctx))
		if err == nil && ct.RowsAffected() == 0 {
			return pgx.ErrNoRows
		}
		return err
	default:
		return errors.New("workspace entity_type must be person, company, deal, or task")
	}
}
func (s *Store) ListWorkspaceEntities(ctx context.Context, workspaceID domain.ID, entityType domain.EntityType, limit int) ([]domain.WorkspaceEntity, error) {
	rows, err := s.query(ctx, `
		select workspace_id, entity_type, entity_id, title, subtitle
		from (
			select $1::text as workspace_id, 'person'::text as entity_type, p.id::text as entity_id, trim(p.first_name||' '||p.last_name) as title, p.email as subtitle
			from people p
			join workspace_people wp on wp.person_id=p.id
			where wp.workspace_id=$1::uuid and ($2='' or $2='person') and p.organization_id=$4::uuid
			union all
			select $1::text as workspace_id, 'company'::text as entity_type, c.id::text as entity_id, c.name as title, c.domain as subtitle
			from companies c
			join workspace_companies wc on wc.company_id=c.id
			where wc.workspace_id=$1::uuid and ($2='' or $2='company') and c.organization_id=$4::uuid
			union all
			select $1::text as workspace_id, 'deal'::text as entity_type, d.id::text as entity_id, d.name as title, d.stage as subtitle
			from deals d
			where d.workspace_id=$1::uuid and ($2='' or $2='deal') and d.organization_id=$4::uuid
			union all
			select $1::text as workspace_id, 'task'::text as entity_type, t.id::text as entity_id, t.title as title, t.status::text as subtitle
			from todos t
			where t.workspace_id=$1::uuid and ($2='' or $2='task') and t.organization_id=$4::uuid
		) entities
		order by title
		limit $3`, string(workspaceID), string(entityType), limit, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.WorkspaceEntity
	for rows.Next() {
		var e domain.WorkspaceEntity
		if err := rows.Scan(&e.WorkspaceID, &e.EntityType, &e.EntityID, &e.Title, &e.Subtitle); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
func (s *Store) Search(ctx context.Context, query string, limit int) ([]domain.SearchResult, error) {
	rows, err := s.query(ctx, `select 'person', id, trim(first_name||' '||last_name), email from people where organization_id=$3::uuid and ($1='' or first_name ilike '%'||$1||'%' or last_name ilike '%'||$1||'%' or email ilike '%'||$1||'%') union all select 'company', id, name, domain from companies where organization_id=$3::uuid and ($1='' or name ilike '%'||$1||'%' or domain ilike '%'||$1||'%') union all select 'deal', id, name, stage from deals where organization_id=$3::uuid and ($1='' or name ilike '%'||$1||'%') order by 3 limit $2`, query, limit, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.SearchResult
	for rows.Next() {
		var r domain.SearchResult
		if err := rows.Scan(&r.EntityType, &r.EntityID, &r.Title, &r.Subtitle); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
func (s *Store) CreateTodo(ctx context.Context, t domain.Todo) (domain.Todo, error) {
	err := s.queryRow(ctx, `insert into todos (organization_id,workspace_id,entity_type,entity_id,title,body,due_at,priority,status) values ($1::uuid,nullif($2,'')::uuid,nullif($3,'')::text,nullif($4,'')::uuid,$5,$6,$7,$8,$9) returning id, coalesce(workspace_id::text,''), coalesce(entity_type,''), coalesce(entity_id::text,''), title, body, due_at, priority, status, created_at, completed_at`, organizationID(ctx), t.WorkspaceID, t.EntityType, t.EntityID, t.Title, t.Body, t.DueAt, t.Priority, t.Status).Scan(&t.ID, &t.WorkspaceID, &t.EntityType, &t.EntityID, &t.Title, &t.Body, &t.DueAt, &t.Priority, &t.Status, &t.CreatedAt, &t.CompletedAt)
	return t, err
}
func (s *Store) GetTodo(ctx context.Context, id domain.ID) (domain.Todo, error) {
	var t domain.Todo
	err := s.queryRow(ctx, `select id, coalesce(workspace_id::text,''), coalesce(entity_type,''), coalesce(entity_id::text,''), title, body, due_at, priority, status, created_at, completed_at from todos where id=$1 and organization_id=$2::uuid`, id, organizationID(ctx)).Scan(&t.ID, &t.WorkspaceID, &t.EntityType, &t.EntityID, &t.Title, &t.Body, &t.DueAt, &t.Priority, &t.Status, &t.CreatedAt, &t.CompletedAt)
	return t, err
}
func (s *Store) UpdateTodo(ctx context.Context, t domain.Todo) (domain.Todo, error) {
	err := s.queryRow(ctx, `update todos set workspace_id=nullif($3,'')::uuid, entity_type=nullif($4,'')::text, entity_id=nullif($5,'')::uuid, title=$6, body=$7, due_at=$8, priority=$9, status=$10, completed_at=case when $10='done' and completed_at is null then now() when $10='open' then null else completed_at end where id=$1 and organization_id=$2::uuid returning id, coalesce(workspace_id::text,''), coalesce(entity_type,''), coalesce(entity_id::text,''), title, body, due_at, priority, status, created_at, completed_at`, t.ID, organizationID(ctx), t.WorkspaceID, t.EntityType, t.EntityID, t.Title, t.Body, t.DueAt, t.Priority, t.Status).Scan(&t.ID, &t.WorkspaceID, &t.EntityType, &t.EntityID, &t.Title, &t.Body, &t.DueAt, &t.Priority, &t.Status, &t.CreatedAt, &t.CompletedAt)
	return t, err
}
func (s *Store) CompleteTodo(ctx context.Context, id domain.ID) (domain.Todo, error) {
	var t domain.Todo
	err := s.queryRow(ctx, `update todos set status='done', completed_at=now() where id=$1 and organization_id=$2::uuid returning id, coalesce(workspace_id::text,''), coalesce(entity_type,''), coalesce(entity_id::text,''), title, body, due_at, priority, status, created_at, completed_at`, id, organizationID(ctx)).Scan(&t.ID, &t.WorkspaceID, &t.EntityType, &t.EntityID, &t.Title, &t.Body, &t.DueAt, &t.Priority, &t.Status, &t.CreatedAt, &t.CompletedAt)
	return t, err
}
func (s *Store) DeleteTodo(ctx context.Context, id domain.ID) error {
	_, err := s.exec(ctx, `delete from todos where id=$1 and organization_id=$2::uuid`, id, organizationID(ctx))
	return err
}
func (s *Store) ListTodos(ctx context.Context, query, status, due string, entityType domain.EntityType, entityID domain.ID, workspaceID domain.ID, limit, offset int) ([]domain.Todo, error) {
	rows, err := s.query(ctx, `select t.id, coalesce(t.workspace_id::text,''), coalesce(t.entity_type,''), coalesce(t.entity_id::text,''), t.title, t.body, t.due_at, t.priority, t.status, t.created_at, t.completed_at from todos t left join people p on t.entity_type='person' and p.id=t.entity_id left join companies c on t.entity_type='company' and c.id=t.entity_id left join deals d on t.entity_type='deal' and d.id=t.entity_id where ($1='' or t.title ilike '%'||$1||'%' or t.body ilike '%'||$1||'%' or t.status ilike '%'||$1||'%' or t.priority ilike '%'||$1||'%' or t.entity_type ilike '%'||$1||'%' or p.first_name ilike '%'||$1||'%' or p.last_name ilike '%'||$1||'%' or p.email ilike '%'||$1||'%' or c.name ilike '%'||$1||'%' or c.domain ilike '%'||$1||'%' or d.name ilike '%'||$1||'%' or d.stage ilike '%'||$1||'%') and ($2='' or t.status=$2) and ($3='' or t.entity_type=$3) and ($4='' or t.entity_id=$4::uuid) and ($5='' or t.workspace_id=$5::uuid) and ($6='' or ($6='none' and t.due_at is null) or ($6='overdue' and t.due_at < now() and t.status <> 'done') or ($6='today' and t.due_at >= date_trunc('day', now()) and t.due_at < date_trunc('day', now()) + interval '1 day') or ($6='upcoming' and t.due_at >= date_trunc('day', now()) + interval '1 day')) and t.organization_id=$9::uuid order by case t.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end, t.due_at nulls last, t.created_at desc, t.id desc limit $7 offset $8`, query, status, entityType, entityID, workspaceID, due, limit, offset, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Todo
	for rows.Next() {
		var t domain.Todo
		if err := rows.Scan(&t.ID, &t.WorkspaceID, &t.EntityType, &t.EntityID, &t.Title, &t.Body, &t.DueAt, &t.Priority, &t.Status, &t.CreatedAt, &t.CompletedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
func (s *Store) ListActionItems(ctx context.Context, limit int) ([]domain.Todo, error) {
	rows, err := s.query(ctx, `select id, coalesce(workspace_id::text,''), coalesce(entity_type,''), coalesce(entity_id::text,''), title, body, due_at, priority, status, created_at, completed_at from todos where status='open' and organization_id=$2::uuid order by case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end, due_at nulls last, created_at desc limit $1`, limit, organizationID(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Todo
	for rows.Next() {
		var t domain.Todo
		if err := rows.Scan(&t.ID, &t.WorkspaceID, &t.EntityType, &t.EntityID, &t.Title, &t.Body, &t.DueAt, &t.Priority, &t.Status, &t.CreatedAt, &t.CompletedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

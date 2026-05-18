package main

import (
	"context"
	"encoding/csv"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"crme/internal/config"
)

type row map[string]string

func main() {
	ctx := context.Background()
	var dir string
	dryRun := false
	for _, a := range os.Args[1:] {
		if a == "--dry-run" {
			dryRun = true
			continue
		}
		if dir != "" {
			fatalf("multiple import directories provided: %q and %q", dir, a)
		}
		dir = a
	}
	if dir == "" {
		fatalf("usage: import-twenty [--dry-run] <directory-containing-twenty-csvs>")
	}

	companies := mustCSV(filepath.Join(dir, "company.csv"))
	people := mustCSV(filepath.Join(dir, "person.csv"))
	opps := mustCSV(filepath.Join(dir, "opportunity.csv"))
	notes := mustCSV(filepath.Join(dir, "note.csv"))
	tasks := mustCSV(filepath.Join(dir, "task.csv"))

	usedCompanies := map[string]bool{}
	for _, p := range people {
		if id := trim(p["Company Id"]); id != "" {
			usedCompanies[id] = true
		}
	}
	for _, o := range opps {
		if id := trim(o["Company Id"]); id != "" {
			usedCompanies[id] = true
		}
	}
	usedCompanyRows := 0
	for _, c := range companies {
		if usedCompanies[trim(c["Id"])] {
			usedCompanyRows++
		}
	}
	fmt.Printf("Twenty import from %s\n", dir)
	fmt.Printf("companies: %d total, %d used, %d skipped unused\n", len(companies), usedCompanyRows, len(companies)-usedCompanyRows)
	fmt.Printf("people: %d\n", len(people))
	fmt.Printf("opportunities: %d\n", len(opps))
	fmt.Printf("notes: %d\n", len(notes))
	fmt.Printf("tasks: %d\n", len(tasks))
	if dryRun {
		return
	}

	cfg := config.Load()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	must(err)
	defer pool.Close()
	must(pool.Ping(ctx))

	tx, err := pool.Begin(ctx)
	must(err)
	defer tx.Rollback(ctx)

	companyIDs := map[string]string{}
	personIDs := map[string]string{}
	dealIDs := map[string]string{}

	var nCompanies, nPeople, nLinks, nDeals, nDealPeople, nDealCompanies, nNotes, nTasks int
	for _, c := range companies {
		extID := trim(c["Id"])
		if !usedCompanies[extID] {
			continue
		}
		id, created := upsertCompany(ctx, tx, trim(c["Name"]), normalizeDomain(firstNonEmpty(c["Domain Name / Link URL"], c["Domain Name / Link Label"])))
		companyIDs[extID] = id
		if created {
			nCompanies++
		}
	}

	for _, p := range people {
		extID := trim(p["Id"])
		id, created := upsertPerson(ctx, tx, p)
		personIDs[extID] = id
		if created {
			nPeople++
		}
		if cid := trim(p["Company Id"]); cid != "" {
			if companyID := companyIDs[cid]; companyID != "" {
				_, err := tx.Exec(ctx, `insert into person_companies (person_id, company_id, role) values ($1,$2,'') on conflict do nothing`, id, companyID)
				must(err)
				nLinks++
			}
		}
	}

	for _, o := range opps {
		extID := trim(o["Id"])
		id, created := insertDeal(ctx, tx, o)
		dealIDs[extID] = id
		if created {
			nDeals++
		}
		if pid := personIDs[trim(o["Point of Contact Id"])]; pid != "" {
			_, err := tx.Exec(ctx, `insert into deal_people (deal_id, person_id) values ($1,$2) on conflict do nothing`, id, pid)
			must(err)
			nDealPeople++
		}
		if cid := companyIDs[trim(o["Company Id"])]; cid != "" {
			_, err := tx.Exec(ctx, `insert into deal_companies (deal_id, company_id) values ($1,$2) on conflict do nothing`, id, cid)
			must(err)
			nDealCompanies++
		}
	}

	_ = dealIDs
	for _, n := range notes {
		body := trim(n["Body / Markdown"])
		if body == "" {
			body = trim(n["Title"])
		}
		if body == "" {
			continue
		}
		created := parseTime(n["Creation date"])
		_, err := tx.Exec(ctx, `insert into activities (type, body, occurred_at, created_at) values ('note',$1,$2,$2)`, body, created)
		must(err)
		nNotes++
	}
	for _, t := range tasks {
		title := trim(t["Title"])
		body := trim(t["Body / Markdown"])
		status := "open"
		if strings.EqualFold(trim(t["Status"]), "DONE") || strings.EqualFold(trim(t["Status"]), "COMPLETED") {
			status = "done"
		}
		created := parseTime(t["Creation date"])
		due := nullableTime(t["Due Date"])
		_, err := tx.Exec(ctx, `insert into todos (title, body, status, due_at, created_at, completed_at) values ($1,$2,$3,$4::timestamptz,$5::timestamptz,case when $3='done' then $5::timestamptz else null end)`, title, body, status, due, created)
		must(err)
		nTasks++
	}

	must(tx.Commit(ctx))
	fmt.Printf("imported: %d companies, %d people, %d person-company links, %d deals, %d deal-person links, %d deal-company links, %d notes, %d tasks\n", nCompanies, nPeople, nLinks, nDeals, nDealPeople, nDealCompanies, nNotes, nTasks)
}

func upsertCompany(ctx context.Context, tx pgx.Tx, name, domain string) (string, bool) {
	var id string
	if domain != "" {
		err := tx.QueryRow(ctx, `select id::text from companies where lower(domain)=lower($1) limit 1`, domain).Scan(&id)
		if err == nil {
			return id, false
		}
	}
	if name != "" {
		err := tx.QueryRow(ctx, `select id::text from companies where lower(name)=lower($1) limit 1`, name).Scan(&id)
		if err == nil {
			return id, false
		}
	}
	must(tx.QueryRow(ctx, `insert into companies (name, domain) values ($1,$2) returning id::text`, name, domain).Scan(&id))
	return id, true
}

func upsertPerson(ctx context.Context, tx pgx.Tx, p row) (string, bool) {
	email := strings.ToLower(trim(p["Emails / Primary Email"]))
	var id string
	if email != "" {
		err := tx.QueryRow(ctx, `select id::text from people where lower(email)=lower($1) limit 1`, email).Scan(&id)
		if err == nil {
			return id, false
		}
	}
	must(tx.QueryRow(ctx, `insert into people (first_name,last_name,email,phone,title,city,status,source,my_turn) values ($1,$2,$3,'','',$4,$5,$6,$7) returning id::text`, trim(p["Name / First Name"]), trim(p["Name / Last Name"]), email, trim(p["City"]), trim(p["Status"]), trim(p["Source"]), parseBool(p["My Turn"])).Scan(&id))
	return id, true
}

func insertDeal(ctx context.Context, tx pgx.Tx, o row) (string, bool) {
	name := trim(o["Name"])
	var id string
	err := tx.QueryRow(ctx, `select id::text from deals where name=$1 limit 1`, name).Scan(&id)
	if err == nil {
		return id, false
	}
	must(tx.QueryRow(ctx, `insert into deals (name,stage,value_cents,currency) values ($1,$2,$3,$4) returning id::text`, name, strings.ToLower(trim(o["Stage"])), amountCents(o["Amount / Amount"]), defaultString(trim(o["Amount / Currency"]), "USD")).Scan(&id))
	return id, true
}

func mustCSV(path string) []row {
	f, err := os.Open(path)
	must(err)
	defer f.Close()
	r := csv.NewReader(f)
	r.FieldsPerRecord = -1
	recs, err := r.ReadAll()
	must(err)
	if len(recs) == 0 {
		return nil
	}
	recs[0][0] = strings.TrimPrefix(recs[0][0], "\ufeff")
	out := make([]row, 0, len(recs)-1)
	for _, rec := range recs[1:] {
		m := row{}
		for i, h := range recs[0] {
			if i < len(rec) {
				m[h] = rec[i]
			}
		}
		out = append(out, m)
	}
	return out
}

func normalizeDomain(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if !strings.Contains(s, "://") {
		s = "https://" + s
	}
	u, err := url.Parse(s)
	if err != nil || u.Host == "" {
		return strings.TrimPrefix(strings.TrimPrefix(s, "https://"), "http://")
	}
	return strings.TrimPrefix(strings.ToLower(u.Host), "www.")
}
func amountCents(s string) int64 {
	f, _ := strconv.ParseFloat(strings.TrimSpace(s), 64)
	return int64(f*100 + 0.5)
}
func parseBool(s string) bool {
	b, _ := strconv.ParseBool(strings.ToLower(strings.TrimSpace(s)))
	return b
}
func parseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339Nano, strings.TrimSpace(s))
	if err != nil {
		return time.Now().UTC()
	}
	return t
}
func nullableTime(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	t := parseTime(s)
	return t
}
func firstNonEmpty(vs ...string) string {
	for _, v := range vs {
		if trim(v) != "" {
			return trim(v)
		}
	}
	return ""
}
func defaultString(s, d string) string {
	if s == "" {
		return d
	}
	return s
}
func trim(s string) string { return strings.TrimSpace(s) }
func must(err error) {
	if err != nil {
		panic(err)
	}
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(2)
}

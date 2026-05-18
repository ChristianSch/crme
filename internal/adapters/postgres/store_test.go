package postgres

import "testing"

func TestRequiresTenantAccess(t *testing.T) {
	cases := []struct {
		name string
		sql  string
		want bool
	}{
		{name: "crm table", sql: "select id from people where id=$1", want: true},
		{name: "organization table", sql: "select * from organization_members", want: true},
		{name: "auth table not tenant guarded", sql: "select id from users where email=$1", want: false},
		{name: "schema check args carry table names", sql: "select to_regclass($1) is not null", want: false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := requiresTenantAccess(tc.sql); got != tc.want {
				t.Fatalf("requiresTenantAccess(%q)=%v, want %v", tc.sql, got, tc.want)
			}
		})
	}
}

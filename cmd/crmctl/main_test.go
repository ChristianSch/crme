package main

import "testing"

func TestQueryEncodesArgs(t *testing.T) {
	got := query([]string{"q=Ada Lovelace", "limit=10"})
	want := "?limit=10&q=Ada+Lovelace"
	if got != want {
		t.Fatalf("query() = %q, want %q", got, want)
	}
}

func TestQueryExceptOmitsPathArgs(t *testing.T) {
	got := queryExcept([]string{"id=person-1", "limit=5"}, "id")
	want := "?limit=5"
	if got != want {
		t.Fatalf("queryExcept() = %q, want %q", got, want)
	}
}

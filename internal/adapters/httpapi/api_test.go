package httpapi

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"crme/internal/usecase"
	"github.com/jackc/pgx/v5"
)

func TestSecurityMiddlewareRejectsBadOrigin(t *testing.T) {
	api := API{AllowedOrigins: []string{"http://localhost:3000"}}
	handler := api.securityMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodPost, "/people", nil)
	req.Header.Set("Origin", "https://evil.example")
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", res.Code)
	}
}

func TestSecurityMiddlewareAllowsConfiguredOrigin(t *testing.T) {
	api := API{AllowedOrigins: []string{"http://localhost:3000"}}
	handler := api.securityMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodPost, "/people", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", res.Code)
	}
}

func TestWriteJSONEncodesNilSliceAsEmptyArray(t *testing.T) {
	var out []string
	res := httptest.NewRecorder()

	writeJSON(res, http.StatusOK, out)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	if res.Body.String() != "[]\n" {
		t.Fatalf("expected empty array, got %q", res.Body.String())
	}
}

func TestErrorResponseStatusMapping(t *testing.T) {
	tests := []struct {
		name   string
		err    error
		status int
	}{
		{"validation", usecase.ErrValidation, http.StatusBadRequest},
		{"unauthorized", usecase.ErrUnauthorized, http.StatusUnauthorized},
		{"forbidden", usecase.ErrForbidden, http.StatusForbidden},
		{"not found", usecase.ErrNotFound, http.StatusNotFound},
		{"pg no rows", pgx.ErrNoRows, http.StatusNotFound},
		{"conflict", usecase.ErrConflict, http.StatusConflict},
		{"internal", errors.New("boom"), http.StatusInternalServerError},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, _ := errorResponse(tt.err)
			if status != tt.status {
				t.Fatalf("expected %d, got %d", tt.status, status)
			}
		})
	}
}

package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	AppEnv               string
	HTTPAddr             string
	DatabaseURL          string
	AppBaseURL           string
	FrontendBaseURL      string
	CookieDomain         string
	AllowedOrigins       []string
	MagicLinkSecret      string
	BootstrapOwnerEmail  string
	AllowSignup          bool
	SMTPFrom             string
	ResendAPIKey         string
	ResendDomain         string
	OpenRouterAPIKey     string
	OpenRouterModel      string
	LangSmithAPIKey      string
	LangSmithProject     string
	LangSmithEndpoint    string
	AgentTraceContent    string
	SecretKey            string
	EmailSyncInterval    string
	HousekeepingInterval string
	LogLevel             string
	LogFormat            string
}

func Load() Config {
	return Config{
		AppEnv:               env("APP_ENV", "dev"),
		HTTPAddr:             env("HTTP_ADDR", ":8080"),
		DatabaseURL:          env("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/crme?sslmode=disable"),
		AppBaseURL:           env("APP_BASE_URL", "http://localhost:8080"),
		FrontendBaseURL:      env("FRONTEND_BASE_URL", "http://localhost:3000"),
		CookieDomain:         env("CRME_COOKIE_DOMAIN", ""),
		AllowedOrigins:       csvEnv("CRME_ALLOWED_ORIGINS", "chrome-extension://kkfpdeggkbniiaajibbejcfcicbbilmn"),
		MagicLinkSecret:      env("MAGIC_LINK_SECRET", "dev-secret-change-me"),
		BootstrapOwnerEmail:  env("BOOTSTRAP_OWNER_EMAIL", ""),
		AllowSignup:          boolEnv("CRME_ALLOW_SIGNUP", false),
		SMTPFrom:             env("SMTP_FROM", "no-reply@example.local"),
		ResendAPIKey:         env("RESEND_API_KEY", ""),
		ResendDomain:         env("RESEND_DOMAIN", ""),
		OpenRouterAPIKey:     env("OPENROUTER_API_KEY", ""),
		OpenRouterModel:      env("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
		LangSmithAPIKey:      envFirst([]string{"LANGSMITH_API_KEY", "LANGCHAIN_API_KEY"}, ""),
		LangSmithProject:     envFirst([]string{"LANGSMITH_PROJECT", "LANGCHAIN_PROJECT"}, "crme"),
		LangSmithEndpoint:    envFirst([]string{"LANGSMITH_ENDPOINT", "LANGCHAIN_ENDPOINT"}, "https://api.smith.langchain.com"),
		AgentTraceContent:    env("AGENT_TRACE_CONTENT", "metadata"),
		SecretKey:            env("CRME_SECRET_KEY", ""),
		EmailSyncInterval:    env("EMAIL_SYNC_INTERVAL", ""),
		HousekeepingInterval: env("HOUSEKEEPING_INTERVAL", "1h"),
		LogLevel:             env("LOG_LEVEL", "info"),
		LogFormat:            env("LOG_FORMAT", "text"),
	}
}

func (c Config) Validate() error {
	if c.AppEnv != "dev" && c.AppEnv != "prod" {
		return fmt.Errorf("APP_ENV must be dev or prod")
	}
	if c.AppEnv == "prod" && c.MagicLinkSecret == "dev-secret-change-me" {
		return fmt.Errorf("MAGIC_LINK_SECRET must be set in prod")
	}
	if c.AppEnv == "prod" && (strings.TrimSpace(c.ResendAPIKey) == "" || strings.TrimSpace(c.ResendDomain) == "") {
		return fmt.Errorf("RESEND_API_KEY and RESEND_DOMAIN must be set in prod")
	}
	if c.LogFormat != "text" && c.LogFormat != "json" {
		return fmt.Errorf("LOG_FORMAT must be text or json")
	}
	if c.AgentTraceContent != "" && c.AgentTraceContent != "none" && c.AgentTraceContent != "metadata" && c.AgentTraceContent != "full" {
		return fmt.Errorf("AGENT_TRACE_CONTENT must be none, metadata, or full")
	}
	return nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envFirst(keys []string, fallback string) string {
	for _, key := range keys {
		if v := os.Getenv(key); v != "" {
			return v
		}
	}
	return fallback
}

func boolEnv(key string, fallback bool) bool {
	value := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if value == "" {
		return fallback
	}
	return value == "1" || value == "true" || value == "yes" || value == "on"
}

func csvEnv(key, fallback string) []string {
	value := env(key, fallback)
	if value == "" {
		return nil
	}
	var out []string
	for _, item := range strings.Split(value, ",") {
		item = strings.TrimSpace(item)
		if item != "" {
			out = append(out, item)
		}
	}
	return out
}

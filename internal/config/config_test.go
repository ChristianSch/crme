package config

import (
	"slices"
	"testing"
)

func TestValidateRejectsProdDefaultMagicLinkSecret(t *testing.T) {
	cfg := Config{AppEnv: "prod", MagicLinkSecret: "dev-secret-change-me"}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected prod default magic link secret to be rejected")
	}
}

func TestValidateAllowsDevDefaults(t *testing.T) {
	cfg := Config{AppEnv: "dev", MagicLinkSecret: "dev-secret-change-me", LogFormat: "text"}
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
}

func TestValidateRejectsInvalidLogFormat(t *testing.T) {
	cfg := Config{AppEnv: "dev", MagicLinkSecret: "dev-secret-change-me", LogFormat: "xml"}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected invalid log format to be rejected")
	}
}

func TestLoadAlwaysAllowsBundledExtensionOrigin(t *testing.T) {
	t.Setenv("CRME_ALLOWED_ORIGINS", "https://getcrme.com")

	cfg := Load()

	if !slices.Contains(cfg.AllowedOrigins, bundledChromeExtensionOrigin) {
		t.Fatalf("expected bundled extension origin, got %v", cfg.AllowedOrigins)
	}
	if !slices.Contains(cfg.AllowedOrigins, "https://getcrme.com") {
		t.Fatalf("expected configured origin, got %v", cfg.AllowedOrigins)
	}
}

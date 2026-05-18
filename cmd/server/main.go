package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"time"

	"crme/internal/adapters/ai"
	emailadapter "crme/internal/adapters/email"
	"crme/internal/adapters/httpapi"
	"crme/internal/adapters/notifications"
	"crme/internal/adapters/postgres"
	"crme/internal/config"
	"crme/internal/ports"
	"crme/internal/secrets"
	"crme/internal/usecase"
)

func main() {
	cfg := config.Load()
	configureLogger(cfg)
	if err := cfg.Validate(); err != nil {
		slog.Error("invalid config", "error", err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	store, err := postgres.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("connect postgres", "error", err)
		os.Exit(1)
	}
	defer store.Close()
	if err := store.CheckRequiredTables(ctx); err != nil {
		slog.Error("check database schema", "error", err)
		os.Exit(1)
	}
	var aiAdapter ports.AICompleter
	if cfg.OpenRouterAPIKey != "" {
		aiAdapter = ai.OpenRouter{APIKey: cfg.OpenRouterAPIKey, Model: cfg.OpenRouterModel}
	}
	var secretBox *secrets.Box
	if cfg.SecretKey != "" {
		secretBox, err = secrets.NewBox(cfg.SecretKey)
		if err != nil {
			slog.Error("configure runtime secrets", "error", err)
			os.Exit(1)
		}
	}
	secretResolver := secrets.RuntimeResolver{Store: store, Box: secretBox}
	imapClient := emailadapter.IMAPClient{AllowPrivateHosts: cfg.AppEnv == "dev"}
	emailService := usecase.EmailService{UOW: store, Accounts: store, Messages: store, People: store, Companies: store, Activities: store, Prompts: store, Secrets: store, Audit: store, Box: secretBox, SecretResolver: secretResolver, Fetcher: imapClient, Tester: imapClient}
	var magicLinkSender ports.MagicLinkSender
	if cfg.AppEnv == "prod" {
		magicLinkSender = notifications.ResendMagicLinkSender{APIKey: cfg.ResendAPIKey, Domain: cfg.ResendDomain}
	} else if cfg.ResendAPIKey != "" && cfg.ResendDomain != "" {
		magicLinkSender = notifications.ResendMagicLinkSender{APIKey: cfg.ResendAPIKey, Domain: cfg.ResendDomain}
	} else {
		magicLinkSender = notifications.LogMagicLinkSender{}
	}
	api := httpapi.API{
		Auth:                  usecase.AuthService{Store: store, Organizations: store, Audit: store, Sender: magicLinkSender, BaseURL: cfg.AppBaseURL, InvitationBaseURL: cfg.FrontendBaseURL, Secret: cfg.MagicLinkSecret, BootstrapOwnerEmail: cfg.BootstrapOwnerEmail, AllowSignup: cfg.AllowSignup},
		AuthRedirectURL:       cfg.FrontendBaseURL,
		CookieSecure:          cfg.AppEnv == "prod",
		CookieDomain:          cfg.CookieDomain,
		AllowedOrigins:        append([]string{cfg.FrontendBaseURL, cfg.AppBaseURL}, cfg.AllowedOrigins...),
		MagicLinkEmailLimiter: httpapi.NewMemoryRateLimiter(time.Hour, 5),
		MagicLinkIPLimiter:    httpapi.NewMemoryRateLimiter(time.Hour, 20),
		CRM:                   usecase.CRMService{UOW: store, People: store, Companies: store, Deals: store, Relationships: store, Activities: store, Tags: store, Workspaces: store, SearchStore: store, Todos: store},
		AI:                    usecase.AIService{UOW: store, Prompts: store, Conversations: store, People: store, Companies: store, Deals: store, Relationships: store, Activities: store, Tags: store, Workspaces: store, Search: store, Todos: store, Emails: store, AI: aiAdapter},
		Suggestions:           usecase.SuggestionService{UOW: store, Prompts: store, People: store, Companies: store, Relationships: store, Activities: store, Emails: store},
		Email:                 emailService,
		Audit:                 usecase.AuditService{Store: store},
	}
	if cfg.EmailSyncInterval != "" {
		interval, err := time.ParseDuration(cfg.EmailSyncInterval)
		if err != nil {
			slog.Error("parse EMAIL_SYNC_INTERVAL", "error", err)
			os.Exit(1)
		}
		go runEmailSync(ctx, emailService, interval)
	}
	if cfg.HousekeepingInterval != "" {
		interval, err := time.ParseDuration(cfg.HousekeepingInterval)
		if err != nil {
			slog.Error("parse HOUSEKEEPING_INTERVAL", "error", err)
			os.Exit(1)
		}
		go runHousekeeping(ctx, usecase.HousekeepingService{Store: store}, interval)
	}
	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: api.Handler(), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutCtx)
	}()
	slog.Info("listening", "addr", cfg.HTTPAddr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("server", "error", err)
		os.Exit(1)
	}
}

func configureLogger(cfg config.Config) {
	level := slog.LevelInfo
	switch cfg.LogLevel {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}
	opts := &slog.HandlerOptions{Level: level}
	if cfg.LogFormat == "json" {
		slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, opts)))
		return
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, opts)))
}

func runHousekeeping(ctx context.Context, svc usecase.HousekeepingService, interval time.Duration) {
	if interval <= 0 {
		return
	}
	run := func() {
		report, err := svc.Run(ctx)
		if err != nil {
			slog.Error("housekeeping", "error", err)
			return
		}
		if report.DeletedMagicLinks > 0 || report.DeletedSessions > 0 {
			slog.Info("housekeeping", "deleted_magic_links", report.DeletedMagicLinks, "deleted_sessions", report.DeletedSessions)
		}
	}
	run()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			run()
		}
	}
}

func runEmailSync(ctx context.Context, svc usecase.EmailService, interval time.Duration) {
	if interval <= 0 {
		return
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			report, err := svc.SyncAccounts(ctx, 50)
			if err != nil {
				slog.Error("email sync", "error", err)
				continue
			}
			if report.NewMessages > 0 || len(report.Errors) > 0 {
				slog.Info("email sync", "accounts", report.Accounts, "new_messages", report.NewMessages, "errors", report.Errors)
			}
		}
	}
}

"use client";

import { useCallback, useEffect, useState } from "react";

import { CrmRouteShell, LoginScreen, OrganizationGate, useLogout, useOrganizationSwitcher, usePersistedSidebar, usePersistedWorkspace } from "@/components/crm/crm-shared";
import { PlainToast } from "@/components/views/toasts";
import { SettingsPanel } from "@/components/views/settings-panel";
import { useCrmShell } from "@/hooks/use-crm-shell";
import { api, ApiToken, AuditLog, EmailAccount, OrganizationInvitation, OrganizationMember } from "@/lib/api";

type RelationLoadState = "idle" | "loading" | "ready" | "error";

export function SettingsView({ initialSidebarCollapsed = false, initialWorkspaceId = "all" }: { initialSidebarCollapsed?: boolean; initialWorkspaceId?: string }) {
  const shell = useCrmShell();
  const [workspaceId, setWorkspaceId] = usePersistedWorkspace(initialWorkspaceId);
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedSidebar(initialSidebarCollapsed);
  const setOrganizationId = useOrganizationSwitcher(shell.loadShell);
  const logout = useLogout(shell.loadShell);

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([]);
  const [settingsState, setSettingsState] = useState<RelationLoadState>("idle");
  const [settingsError, setSettingsError] = useState("");
  const [toast, setToast] = useState("");

  const loadSettings = useCallback(async () => {
    if (shell.state !== "ready" || !shell.selectedOrganizationId) return;
    setSettingsState("loading");
    setSettingsError("");
    try {
      const canManage = shell.organizations.find((org) => org.organization_id === shell.selectedOrganizationId)?.role;
      const [nextMembers, nextInvitations, nextAccounts, nextTokens, nextAuditLogs] = await Promise.all([
        api.organizationMembers(shell.selectedOrganizationId),
        api.organizationInvitations(shell.selectedOrganizationId),
        api.emailAccounts(),
        api.apiTokens(),
        canManage === "owner" || canManage === "admin" ? api.auditLogs() : Promise.resolve([]),
      ]);
      setMembers(nextMembers ?? []);
      setInvitations(nextInvitations ?? []);
      setEmailAccounts(nextAccounts ?? []);
      setApiTokens(nextTokens ?? []);
      setAuditLogs(nextAuditLogs ?? []);
      setSettingsState("ready");
    } catch (error) {
      setMembers([]);
      setEmailAccounts([]);
      setApiTokens([]);
      setAuditLogs([]);
      setSettingsError(error instanceof Error ? error.message : "Could not load settings");
      setSettingsState("error");
    }
  }, [shell.organizations, shell.selectedOrganizationId, shell.state]);

  useEffect(() => {
    if (shell.state !== "ready") return;
    queueMicrotask(() => void loadSettings());
  }, [loadSettings, shell.state]);

  if (shell.state === "unauthorized") return <LoginScreen onRetry={shell.loadShell} />;
  if (shell.state === "needs-organization") return <OrganizationGate userEmail={shell.me?.user.email} organizations={shell.organizations} selectedOrganizationId={shell.selectedOrganizationId} onSelect={setOrganizationId} onCreated={(id) => void shell.loadShell(id)} />;

  return (
    <>
      <CrmRouteShell
        title="Settings"
        description="Team access, roles, and invitations."
        organizations={shell.organizations}
        selectedOrganizationId={shell.selectedOrganizationId}
        workspaces={shell.workspaces}
        workspaceId={workspaceId}
        sidebarCollapsed={sidebarCollapsed}
        onOrganizationChange={setOrganizationId}
        onWorkspaceChange={setWorkspaceId}
        onSidebarCollapsedChange={setSidebarCollapsed}
        onLogout={logout}
      >
        <div className="mt-5 min-w-0 overflow-hidden rounded-xl border border-border bg-background">
          <SettingsPanel
            organization={shell.organizations.find((org) => org.organization_id === shell.selectedOrganizationId)}
            members={members}
            invitations={invitations}
            emailAccounts={emailAccounts}
            apiTokens={apiTokens}
            auditLogs={auditLogs}
            state={settingsState}
            error={settingsError}
            onRefresh={loadSettings}
            onToast={setToast}
          />
        </div>
      </CrmRouteShell>
      {toast && <PlainToast message={toast} onClose={() => setToast("")} />}
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const requestIdRef = useRef(0);

  const loadSettings = useCallback(async () => {
    if (shell.state !== "ready" || !shell.selectedOrganizationId) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
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
      if (requestId !== requestIdRef.current) return;
      setMembers(nextMembers ?? []);
      setInvitations(nextInvitations ?? []);
      setEmailAccounts(nextAccounts ?? []);
      setApiTokens(nextTokens ?? []);
      setAuditLogs(nextAuditLogs ?? []);
      setSettingsState("ready");
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
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
            onInviteMember={async (email, role) => {
              if (!shell.selectedOrganizationId) return;
              await api.inviteOrganizationMember(shell.selectedOrganizationId, email, role);
            }}
            onUpdateMemberRole={async (member, role) => {
              if (!shell.selectedOrganizationId) return;
              await api.updateOrganizationMemberRole(shell.selectedOrganizationId, member.user_id, role);
            }}
            onResendInvitation={async (invitation) => {
              if (!shell.selectedOrganizationId || !invitation.id) return;
              await api.resendOrganizationInvitation(shell.selectedOrganizationId, invitation.id);
            }}
            onRemoveMember={async (member) => {
              if (!shell.selectedOrganizationId) return;
              await api.removeOrganizationMember(shell.selectedOrganizationId, member.user_id);
            }}
            onCreateApiToken={(name) => api.createApiToken(name)}
            onRevokeApiToken={(token) => api.revokeApiToken(token.id).then(() => undefined)}
            onTestEmailAccount={(payload) => api.testEmailAccount(payload).then(() => undefined)}
            onCreateEmailAccount={(payload) => api.createEmailAccount(payload).then(() => undefined)}
            onUpdateEmailAccount={(account, payload) => api.updateEmailAccount(account.id, payload).then(() => undefined)}
            onSetEmailSync={(account, syncEnabled) => api.updateEmailAccount(account.id, { ...account, sync_enabled: syncEnabled }).then(() => undefined)}
            onDeleteEmailAccount={(account) => api.deleteEmailAccount(account.id).then(() => undefined)}
          />
        </div>
      </CrmRouteShell>
      {toast && <PlainToast message={toast} onClose={() => setToast("")} />}
    </>
  );
}

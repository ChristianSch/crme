"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { EmptyState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clearStoredSuggestionUndo, type SuggestionUndo } from "@/components/suggestions/suggestions-panel";
import { Toast, ToastClose, ToastProvider, ToastViewport } from "@/components/ui/toast";
import { api, OrganizationMembership, setSelectedOrganizationId as storeSelectedOrganizationId, Workspace } from "@/lib/api";

export function CrmRouteShell({
  title,
  description,
  organizations,
  selectedOrganizationId,
  workspaces,
  workspaceId,
  sidebarCollapsed,
  controls,
  children,
  onOrganizationChange,
  onWorkspaceChange,
  onSidebarCollapsedChange,
  onLogout,
}: {
  title: string;
  description: string;
  organizations: OrganizationMembership[];
  selectedOrganizationId: string;
  workspaces: Workspace[];
  workspaceId: string;
  sidebarCollapsed: boolean;
  controls?: ReactNode;
  children: ReactNode;
  onOrganizationChange: (value: string) => void;
  onWorkspaceChange: (value: string) => void;
  onSidebarCollapsedChange: (value: boolean) => void;
  onLogout: () => Promise<void>;
}) {
  return (
    <AppShell
      title={title}
      description={description}
      sidebarCollapsed={sidebarCollapsed}
      onSidebarCollapsedChange={onSidebarCollapsedChange}
      headerActions={(
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <OrganizationSelect organizations={organizations} value={selectedOrganizationId} onChange={onOrganizationChange} />
          <WorkspaceFilter value={workspaceId} workspaces={workspaces} onChange={onWorkspaceChange} />
          <AccountMenu onLogout={onLogout} />
        </div>
      )}
      controls={controls}
    >
      {children}
    </AppShell>
  );
}

export function usePersistedSidebar(initialSidebarCollapsed: boolean) {
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(initialSidebarCollapsed);

  function setSidebarCollapsed(value: boolean) {
    setSidebarCollapsedState(value);
    document.cookie = `crme_sidebar_collapsed=${String(value)}; path=/; max-age=31536000; samesite=lax`;
  }

  return [sidebarCollapsed, setSidebarCollapsed] as const;
}

export function usePersistedWorkspace(initialWorkspaceId: string) {
  const [workspaceId, setWorkspaceIdState] = useState(initialWorkspaceId);

  function setWorkspaceId(value: string) {
    setWorkspaceIdState(value);
    document.cookie = `crme_workspace_id=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
  }

  return [workspaceId, setWorkspaceId] as const;
}

export function useOrganizationSwitcher(loadShell: (organizationIdOverride?: string) => Promise<void> | void) {
  return function setOrganizationId(value: string) {
    storeSelectedOrganizationId(value);
    void loadShell(value);
  };
}

export function useLogout(loadShell: () => Promise<void> | void) {
  const router = useRouter();
  return async function logout() {
    await api.logout();
    router.refresh();
    void loadShell();
  };
}

export function PagedTable({ children, page, hasNext, loading, onPageChange }: { children: ReactNode; page: number; hasNext: boolean; loading: boolean; onPageChange: (page: number) => void }) {
  return (
    <div>
      {children}
      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
        <span>Page {page + 1}</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-xl" disabled={loading || page === 0} onClick={() => onPageChange(page - 1)}>Previous</Button>
          <Button type="button" variant="outline" size="sm" className="rounded-xl" disabled={loading || !hasNext} onClick={() => onPageChange(page + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}

export function LoginScreen({ onRetry }: { onRetry: () => void }) {
  const [email, setEmail] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem("crme_last_email") || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await api.requestMagicLink(email);
      window.localStorage.setItem("crme_last_email", email);
      setMessage("Check your email for a sign-in link.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send sign-in link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-[-0.035em]">Sign in to CRME</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter your email and we’ll send a magic link.</p>
        <Input className="mt-6" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
        <Button className="mt-4 w-full" disabled={loading}>{loading ? "Sending…" : "Send magic link"}</Button>
        {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <Button type="button" variant="ghost" className="mt-2 w-full" onClick={onRetry}>I already signed in</Button>
      </form>
    </main>
  );
}

export function UndoToast({ undo, onDone, onClose }: { undo: SuggestionUndo; onDone: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);

  async function runUndo() {
    setBusy(true);
    try {
      if (undo.createdEntityType === "company" && undo.createdEntityId) await api.deleteCompany(undo.createdEntityId);
      if (undo.createdEntityType === "person" && undo.createdEntityId) await api.deletePerson(undo.createdEntityId);
      await api.reopenSuggestion(undo.suggestionId);
      clearStoredSuggestionUndo();
      await onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToastProvider duration={10000}>
      <Toast open={open} onOpenChange={(nextOpen) => {
        if (busy && !nextOpen) return;
        setOpen(nextOpen);
        if (!nextOpen) onClose();
      }}>
        <span className="min-w-0 flex-1">{undo.label}</span>
        <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" disabled={busy} onClick={runUndo}>Undo</Button>
        <ToastClose asChild><Button size="sm" variant="ghost" className="h-8 rounded-xl" disabled={busy}>Close</Button></ToastClose>
        <span className="absolute inset-x-0 bottom-0 h-1 origin-left animate-[toast-progress_10s_linear_forwards] bg-primary/55" />
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}

export function OrganizationGate({ userEmail, organizations, selectedOrganizationId, onSelect, onCreated }: { userEmail?: string; organizations: OrganizationMembership[]; selectedOrganizationId: string; onSelect: (id: string) => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const organization = await api.createOrganization(name.trim());
      onCreated(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create organization");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-[-0.035em]">Choose an organization</h1>
        <p className="mt-2 text-sm text-muted-foreground">{userEmail ? `Signed in as ${userEmail}. ` : ""}Pick a workspace to continue.</p>
        {organizations.length ? (
          <div className="mt-6 space-y-2">
            {organizations.map((org) => (
              <Button key={org.organization_id} type="button" variant={org.organization_id === selectedOrganizationId ? "default" : "outline"} className="w-full justify-between rounded-xl" onClick={() => onSelect(org.organization_id)}>
                <span>{org.name}</span>
                <span className="text-xs opacity-70">{org.role}</span>
              </Button>
            ))}
          </div>
        ) : <EmptyState title="No organizations yet" body="Create one to start using CRME." />}
        <form onSubmit={createOrganization} className="mt-6 flex gap-2">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Organization name" required />
          <Button>Create</Button>
        </form>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}

function OrganizationSelect({ organizations, value, onChange }: { organizations: OrganizationMembership[]; value: string; onChange: (value: string) => void }) {
  if (!organizations.length) return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[220px] rounded-xl bg-background shadow-none"><SelectValue placeholder="Organization" /></SelectTrigger>
      <SelectContent align="end" className="rounded-xl p-1">
        {organizations.map((org) => <SelectItem key={org.organization_id} value={org.organization_id} className="rounded-lg">{org.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function WorkspaceFilter({ value, workspaces, onChange }: { value: string; workspaces: Workspace[]; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[180px] rounded-xl bg-background shadow-none"><SelectValue placeholder="Workspace" /></SelectTrigger>
      <SelectContent align="end" className="rounded-xl p-1">
        <SelectItem value="all" className="rounded-lg">All workspaces</SelectItem>
        {workspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id} className="rounded-lg">{workspace.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function AccountMenu({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-xl">
          Account <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl">
        <DropdownMenuLabel>Session</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void onLogout()}>
          <LogOut className="mr-2 size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

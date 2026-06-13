"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CrmRouteShell, LoginScreen, OrganizationGate, useLogout, useOrganizationSwitcher, usePersistedSidebar, usePersistedWorkspace } from "@/components/crm/crm-shared";
import { EmptyState, TableSkeleton } from "@/components/common/data-state";
import { TaskSheet } from "@/components/sheets/task-sheet";
import { DashboardPanel } from "@/components/views/dashboard-panel";
import { useCrmShell } from "@/hooks/use-crm-shell";
import { PAGE_SIZE } from "@/hooks/use-paged-list";
import { api, Company, Deal, Person, Suggestion, Todo } from "@/lib/api";

export function DashboardView({ initialSidebarCollapsed = false, initialWorkspaceId = "all" }: { initialSidebarCollapsed?: boolean; initialWorkspaceId?: string }) {
  const router = useRouter();
  const shell = useCrmShell();
  const [workspaceId, setWorkspaceId] = usePersistedWorkspace(initialWorkspaceId);
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedSidebar(initialSidebarCollapsed);
  const setOrganizationId = useOrganizationSwitcher(shell.loadShell);
  const logout = useLogout(shell.loadShell);

  const [tasks, setTasks] = useState<Todo[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedTask, setSelectedTask] = useState<Todo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const requestIdRef = useRef(0);

  const activeWorkspaceId = workspaceId === "all" ? "" : workspaceId;

  const loadDashboard = useCallback(async () => {
    if (shell.state !== "ready") return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setLoadError("");
    try {
      const [taskData, suggestionData, peopleData, companyData, dealData] = await Promise.all([
        api.tasks({ workspace_id: activeWorkspaceId || undefined, limit: PAGE_SIZE, offset: 0 }),
        api.suggestions("open", PAGE_SIZE, 0),
        api.people("", activeWorkspaceId, PAGE_SIZE, 0),
        api.companies("", activeWorkspaceId, PAGE_SIZE, 0),
        api.deals("", activeWorkspaceId, PAGE_SIZE, 0),
      ]);
      if (requestId !== requestIdRef.current) return;
      setTasks(taskData ?? []);
      setSuggestions(suggestionData ?? []);
      setPeople(peopleData ?? []);
      setCompanies(companyData ?? []);
      setDeals(dealData ?? []);
    } catch (error) {
      if (requestId === requestIdRef.current) setLoadError(error instanceof Error ? error.message : "Could not load dashboard");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [activeWorkspaceId, shell.state]);

  useEffect(() => {
    if (shell.state !== "ready") return;
    queueMicrotask(() => void loadDashboard());
  }, [loadDashboard, shell.state]);

  if (shell.state === "unauthorized") return <LoginScreen onRetry={shell.loadShell} />;
  if (shell.state === "needs-organization") return <OrganizationGate userEmail={shell.me?.user.email} organizations={shell.organizations} selectedOrganizationId={shell.selectedOrganizationId} onSelect={setOrganizationId} onCreated={(id) => void shell.loadShell(id)} />;

  return (
    <>
      <CrmRouteShell
        title="Dashboard"
        description="Open work and CRM prompts that need attention."
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
          {shell.state === "loading" || loading ? <TableSkeleton /> : shell.state === "error" ? <EmptyState title="We’re sorry, something went wrong" body="Please come back later and try again." /> : loadError ? <EmptyState title="Could not load dashboard" body={loadError} /> : (
            <DashboardPanel
              tasks={tasks}
              suggestions={suggestions}
              people={people}
              companies={companies}
              deals={deals}
              onSelectTask={setSelectedTask}
              onSelectPerson={() => router.push("/people")}
              onSelectCompany={() => router.push("/companies")}
              onSelectDeal={() => router.push("/deals")}
              onOpenTasks={() => router.push("/tasks")}
              onOpenSuggestions={() => router.push("/suggestions")}
            />
          )}
        </div>
      </CrmRouteShell>

      <TaskSheet
        task={selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        people={people}
        companies={companies}
        deals={deals}
        workspaceId={activeWorkspaceId}
        onSaveTask={async (task, changes) => {
          const saved = await api.updateTask({ ...task, ...changes });
          setSelectedTask(saved);
          void loadDashboard();
          return saved;
        }}
        onDeleteTask={async (task) => {
          await api.deleteTask(task.id);
          setSelectedTask(null);
          void loadDashboard();
        }}
        onSelectPerson={() => router.push("/people")}
        onSelectCompany={() => router.push("/companies")}
        onSelectDeal={() => router.push("/deals")}
      />
    </>
  );
}

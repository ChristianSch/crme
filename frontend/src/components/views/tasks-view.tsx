"use client";

import { useCallback, useState } from "react";
import { Search, X } from "lucide-react";

import { CrmRouteShell, LoginScreen, OrganizationGate, PagedTable, useLogout, useOrganizationSwitcher, usePersistedSidebar, usePersistedWorkspace } from "@/components/crm/crm-shared";
import { EmptyState, TableSkeleton } from "@/components/common/data-state";
import { TaskSheet } from "@/components/sheets/task-sheet";
import { TasksTable } from "@/components/tables/tasks-table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrmShell } from "@/hooks/use-crm-shell";
import { PAGE_SIZE, usePagedResource } from "@/hooks/use-paged-list";
import { api, Company, Deal, Person, Todo } from "@/lib/api";

export function TasksView({ initialSidebarCollapsed = false, initialWorkspaceId = "all" }: { initialSidebarCollapsed?: boolean; initialWorkspaceId?: string }) {
  const shell = useCrmShell();
  const [workspaceId, setWorkspaceId] = usePersistedWorkspace(initialWorkspaceId);
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedSidebar(initialSidebarCollapsed);
  const setOrganizationId = useOrganizationSwitcher(shell.loadShell);
  const logout = useLogout(shell.loadShell);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"open" | "done" | "all">("all");
  const [dueFilter, setDueFilter] = useState<"today" | "overdue" | "upcoming" | "none" | "all">("all");
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedTask, setSelectedTask] = useState<Todo | null>(null);

  const activeWorkspaceId = workspaceId === "all" ? "" : workspaceId;

  const loadTasksPage = useCallback(async (nextPage: number) => {
    const [nextTasks, nextPeople, nextCompanies, nextDeals] = await Promise.all([
      api.tasks({ q: query, workspace_id: activeWorkspaceId || undefined, status: statusFilter, due: dueFilter, limit: PAGE_SIZE, offset: nextPage * PAGE_SIZE }),
      api.people("", activeWorkspaceId, PAGE_SIZE, 0),
      api.companies("", activeWorkspaceId, PAGE_SIZE, 0),
      api.deals("", activeWorkspaceId, PAGE_SIZE, 0),
    ]);
    return { items: nextTasks ?? [], extra: { people: nextPeople ?? [], companies: nextCompanies ?? [], deals: nextDeals ?? [] } };
  }, [activeWorkspaceId, dueFilter, query, statusFilter]);
  const updateLookups = useCallback((result: { extra?: { people: Person[]; companies: Company[]; deals: Deal[] } }) => {
    setPeople(result.extra?.people ?? []);
    setCompanies(result.extra?.companies ?? []);
    setDeals(result.extra?.deals ?? []);
  }, []);
  const { items: tasks, page, hasNext, loading, loadError, load: loadTasks } = usePagedResource({
    enabled: shell.state === "ready",
    loadPage: loadTasksPage,
    errorMessage: "Could not load tasks",
    onLoaded: updateLookups,
  });

  if (shell.state === "unauthorized") return <LoginScreen onRetry={shell.loadShell} />;
  if (shell.state === "needs-organization") return <OrganizationGate userEmail={shell.me?.user.email} organizations={shell.organizations} selectedOrganizationId={shell.selectedOrganizationId} onSelect={setOrganizationId} onCreated={(id) => void shell.loadShell(id)} />;

  return (
    <>
      <CrmRouteShell
        title="Tasks"
        description="Open work sorted by urgency and relationship."
        organizations={shell.organizations}
        selectedOrganizationId={shell.selectedOrganizationId}
        workspaces={shell.workspaces}
        workspaceId={workspaceId}
        sidebarCollapsed={sidebarCollapsed}
        onOrganizationChange={setOrganizationId}
        onWorkspaceChange={setWorkspaceId}
        onSidebarCollapsedChange={setSidebarCollapsed}
        onLogout={logout}
        controls={shell.state === "ready" ? (
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            <div className="flex w-full flex-col gap-2 sm:flex-row md:max-w-[620px]">
              <div className="relative w-full md:max-w-[360px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search tasks" placeholder="Search tasks" className="h-9 rounded-xl bg-background pl-9 pr-9 shadow-none" />
                {query && <button type="button" aria-label="Clear search" className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" onClick={() => setQuery("")}><X className="size-3.5" /></button>}
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "open" | "done" | "all")}>
                <SelectTrigger className="h-9 w-[118px] rounded-xl bg-background shadow-none"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent align="start" position="popper" className="rounded-xl p-1">
                  <SelectItem value="all" className="rounded-lg">All status</SelectItem>
                  <SelectItem value="open" className="rounded-lg">Open</SelectItem>
                  <SelectItem value="done" className="rounded-lg">Done</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dueFilter} onValueChange={(value) => setDueFilter(value as "today" | "overdue" | "upcoming" | "none" | "all")}>
                <SelectTrigger className="h-9 w-[126px] rounded-xl bg-background shadow-none"><SelectValue placeholder="Due" /></SelectTrigger>
                <SelectContent align="start" position="popper" className="rounded-xl p-1">
                  <SelectItem value="all" className="rounded-lg">Any due</SelectItem>
                  <SelectItem value="overdue" className="rounded-lg">Overdue</SelectItem>
                  <SelectItem value="today" className="rounded-lg">Today</SelectItem>
                  <SelectItem value="upcoming" className="rounded-lg">Upcoming</SelectItem>
                  <SelectItem value="none" className="rounded-lg">No due date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : undefined}
      >
        <div className="mt-5 min-w-0 overflow-hidden rounded-xl border border-border bg-background">
          {shell.state === "loading" ? <TableSkeleton /> : shell.state === "error" ? <EmptyState title="We’re sorry, something went wrong" body="Please come back later and try again." /> : loadError ? <EmptyState title="Could not load tasks" body={loadError} /> : (
            <PagedTable page={page} hasNext={hasNext} loading={loading} onPageChange={loadTasks}>
              <TasksTable tasks={tasks} people={people} companies={companies} deals={deals} onSelect={setSelectedTask} />
            </PagedTable>
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
        onTaskChanged={(task) => {
          setSelectedTask(task);
          void loadTasks(page);
        }}
        onDeleted={() => {
          setSelectedTask(null);
          void loadTasks(0);
        }}
      />
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Search, X } from "lucide-react";

import { CrmRouteShell, LoginScreen, OrganizationGate, PagedTable, useLogout, useOrganizationSwitcher, usePersistedSidebar, usePersistedWorkspace } from "@/components/crm/crm-shared";
import { EmptyState, TableSkeleton } from "@/components/common/data-state";
import { PersonSheet } from "@/components/sheets/person-sheet";
import { PeopleTable } from "@/components/tables/people-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCrmShell } from "@/hooks/use-crm-shell";
import { PAGE_SIZE } from "@/hooks/use-paged-list";
import { api, Company, Person, TimelineItem, Todo } from "@/lib/api";
import { compareDates, toggleSort, type SortDirection } from "@/lib/format";

export function PeopleView({ initialSidebarCollapsed = false, initialWorkspaceId = "all" }: { initialSidebarCollapsed?: boolean; initialWorkspaceId?: string }) {
  const shell = useCrmShell();
  const [workspaceId, setWorkspaceId] = usePersistedWorkspace(initialWorkspaceId);
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedSidebar(initialSidebarCollapsed);
  const setOrganizationId = useOrganizationSwitcher(shell.loadShell);
  const logout = useLogout(shell.loadShell);

  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [lastTouchSort, setLastTouchSort] = useState<SortDirection>("desc");
  const [createOpen, setCreateOpen] = useState(false);

  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [linkedCompanies, setLinkedCompanies] = useState<Company[]>([]);
  const [companyOptions, setCompanyOptions] = useState<Company[]>([]);
  const [tasks, setTasks] = useState<Todo[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [detailRefresh, setDetailRefresh] = useState(0);

  const activeWorkspaceId = workspaceId === "all" ? "" : workspaceId;

  const loadPeople = useCallback(async (nextPage = 0) => {
    if (shell.state !== "ready") return;
    setLoading(true);
    setLoadError("");
    try {
      const next = await api.people(query, activeWorkspaceId, PAGE_SIZE, nextPage * PAGE_SIZE);
      setPeople(next ?? []);
      setPage(nextPage);
      setHasNext((next ?? []).length === PAGE_SIZE);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load people");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, query, shell.state]);

  useEffect(() => {
    if (shell.state !== "ready") return;
    const timeout = window.setTimeout(() => void loadPeople(0), 200);
    return () => window.clearTimeout(timeout);
  }, [loadPeople, shell.state]);

  useEffect(() => {
    let cancelled = false;
    async function loadPersonDetails() {
      if (!selectedPerson) {
        setLinkedCompanies([]);
        setCompanyOptions([]);
        setTasks([]);
        setTimeline([]);
        return;
      }
      try {
        const [items, companies, taskData, allCompanies] = await Promise.all([
          api.timeline("person", selectedPerson.id),
          api.personCompanies(selectedPerson.id),
          api.tasks({ entity_type: "person", entity_id: selectedPerson.id, limit: PAGE_SIZE, offset: 0 }),
          api.companies("", activeWorkspaceId, PAGE_SIZE, 0),
        ]);
        if (!cancelled) {
          setTimeline(items ?? []);
          setLinkedCompanies(companies ?? []);
          setTasks(taskData ?? []);
          setCompanyOptions(allCompanies ?? []);
        }
      } catch {
        if (!cancelled) {
          setTimeline([]);
          setLinkedCompanies([]);
          setTasks([]);
          setCompanyOptions([]);
        }
      }
    }
    void loadPersonDetails();
    return () => { cancelled = true; };
  }, [activeWorkspaceId, detailRefresh, selectedPerson]);

  const filteredPeople = useMemo(() => [...people].sort((a, b) => compareDates(a.last_touch_at, b.last_touch_at, lastTouchSort)), [lastTouchSort, people]);

  if (shell.state === "unauthorized") return <LoginScreen onRetry={shell.loadShell} />;
  if (shell.state === "needs-organization") return <OrganizationGate userEmail={shell.me?.user.email} organizations={shell.organizations} selectedOrganizationId={shell.selectedOrganizationId} onSelect={setOrganizationId} onCreated={(id) => void shell.loadShell(id)} />;

  return (
    <>
      <CrmRouteShell
        title="People"
        description="Contacts, owners, and follow-up context."
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
            <div className="flex w-full flex-col gap-2 sm:flex-row md:max-w-[520px]">
              <div className="relative w-full md:max-w-[360px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search people" placeholder="Search people" className="h-9 rounded-xl bg-background pl-9 pr-9 shadow-none" />
                {query && <button type="button" aria-label="Clear search" className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" onClick={() => setQuery("")}><X className="size-3.5" /></button>}
              </div>
              <Button type="button" className="h-9 shrink-0 rounded-xl" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New person</Button>
            </div>
          </div>
        ) : undefined}
      >
        <div className="mt-5 min-w-0 overflow-hidden rounded-xl border border-border bg-background">
          {shell.state === "loading" ? <TableSkeleton /> : shell.state === "error" ? <EmptyState title="We’re sorry, something went wrong" body="Please come back later and try again." /> : loadError ? <EmptyState title="Could not load people" body={loadError} /> : (
            <PagedTable page={page} hasNext={hasNext} loading={loading} onPageChange={loadPeople}>
              <PeopleTable people={filteredPeople} lastTouchSort={lastTouchSort} onSortLastTouch={() => setLastTouchSort(toggleSort)} onSelect={setSelectedPerson} />
            </PagedTable>
          )}
        </div>
      </CrmRouteShell>

      <CreatePersonSheet open={createOpen} workspaceId={activeWorkspaceId} onOpenChange={setCreateOpen} onCreated={(person) => {
        setSelectedPerson(person);
        void loadPeople(0);
      }} />

      <PersonSheet
        person={selectedPerson}
        onOpenChange={(open) => !open && setSelectedPerson(null)}
        companies={linkedCompanies}
        allCompanies={companyOptions}
        workspaceId={activeWorkspaceId}
        tasks={tasks}
        timeline={timeline}
        onSaved={(person) => {
          setSelectedPerson(person);
          void loadPeople(page);
        }}
        onDeleted={() => {
          setSelectedPerson(null);
          void loadPeople(0);
        }}
        onCompaniesChanged={async () => setDetailRefresh((value) => value + 1)}
        onActivityCreated={() => setDetailRefresh((value) => value + 1)}
        onTaskChanged={() => setDetailRefresh((value) => value + 1)}
      />
    </>
  );
}

function CreatePersonSheet({ open, workspaceId, onOpenChange, onCreated }: { open: boolean; workspaceId: string; onOpenChange: (open: boolean) => void; onCreated: (person: Person) => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function close(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setError("");
    }
  }

  async function createPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const person = await api.createPerson({ workspace_id: workspaceId || undefined, first_name: firstName, last_name: lastName, email });
      close(false);
      onCreated(person);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create person");
    }
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>New person</SheetTitle><SheetDescription>Create a CRM contact.</SheetDescription></SheetHeader>
        <form onSubmit={createPerson} className="mt-6 space-y-4">
          <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" required />
          <Input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last name" />
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full">Create person</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Search, X } from "lucide-react";

import { CrmRouteShell, LoginScreen, OrganizationGate, PagedTable, useLogout, useOrganizationSwitcher, usePersistedSidebar, usePersistedWorkspace } from "@/components/crm/crm-shared";
import { EmptyState, TableSkeleton } from "@/components/common/data-state";
import { CompanySheet } from "@/components/sheets/company-sheet";
import { CompaniesTable } from "@/components/tables/companies-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCrmShell } from "@/hooks/use-crm-shell";
import { PAGE_SIZE } from "@/hooks/use-paged-list";
import { api, Company, Deal, Person, TimelineItem, Todo } from "@/lib/api";
import { compareDates, toggleSort, type SortDirection } from "@/lib/format";

export function CompaniesView({ initialSidebarCollapsed = false, initialWorkspaceId = "all" }: { initialSidebarCollapsed?: boolean; initialWorkspaceId?: string }) {
  const shell = useCrmShell();
  const [workspaceId, setWorkspaceId] = usePersistedWorkspace(initialWorkspaceId);
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedSidebar(initialSidebarCollapsed);
  const setOrganizationId = useOrganizationSwitcher(shell.loadShell);
  const logout = useLogout(shell.loadShell);

  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [lastTouchSort, setLastTouchSort] = useState<SortDirection>("desc");
  const [createOpen, setCreateOpen] = useState(false);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [linkedPeople, setLinkedPeople] = useState<Person[]>([]);
  const [linkedDeals, setLinkedDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Todo[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [detailRefresh, setDetailRefresh] = useState(0);

  const activeWorkspaceId = workspaceId === "all" ? "" : workspaceId;

  const loadCompanies = useCallback(async (nextPage = 0) => {
    if (shell.state !== "ready") return;
    setLoading(true);
    setLoadError("");
    try {
      const next = await api.companies(query, activeWorkspaceId, PAGE_SIZE, nextPage * PAGE_SIZE);
      setCompanies(next ?? []);
      setPage(nextPage);
      setHasNext((next ?? []).length === PAGE_SIZE);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load companies");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, query, shell.state]);

  useEffect(() => {
    if (shell.state !== "ready") return;
    const timeout = window.setTimeout(() => void loadCompanies(0), 200);
    return () => window.clearTimeout(timeout);
  }, [loadCompanies, shell.state]);

  useEffect(() => {
    let cancelled = false;
    async function loadCompanyDetails() {
      if (!selectedCompany) {
        setLinkedPeople([]);
        setLinkedDeals([]);
        setTasks([]);
        setTimeline([]);
        return;
      }
      try {
        const [items, people, deals, taskData] = await Promise.all([
          api.timeline("company", selectedCompany.id),
          api.companyPeople(selectedCompany.id),
          api.companyDeals(selectedCompany.id),
          api.tasks({ entity_type: "company", entity_id: selectedCompany.id, limit: PAGE_SIZE, offset: 0 }),
        ]);
        if (!cancelled) {
          setTimeline(items ?? []);
          setLinkedPeople(people ?? []);
          setLinkedDeals(deals ?? []);
          setTasks(taskData ?? []);
        }
      } catch {
        if (!cancelled) {
          setTimeline([]);
          setLinkedPeople([]);
          setLinkedDeals([]);
          setTasks([]);
        }
      }
    }
    void loadCompanyDetails();
    return () => { cancelled = true; };
  }, [detailRefresh, selectedCompany]);

  const filteredCompanies = useMemo(() => [...companies].sort((a, b) => compareDates(a.last_touch_at, b.last_touch_at, lastTouchSort)), [companies, lastTouchSort]);

  if (shell.state === "unauthorized") return <LoginScreen onRetry={shell.loadShell} />;
  if (shell.state === "needs-organization") return <OrganizationGate userEmail={shell.me?.user.email} organizations={shell.organizations} selectedOrganizationId={shell.selectedOrganizationId} onSelect={setOrganizationId} onCreated={(id) => void shell.loadShell(id)} />;

  return (
    <>
      <CrmRouteShell
        title="Companies"
        description="Accounts, domains, and last touch points."
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
                <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search companies" placeholder="Search companies" className="h-9 rounded-xl bg-background pl-9 pr-9 shadow-none" />
                {query && <button type="button" aria-label="Clear search" className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" onClick={() => setQuery("")}><X className="size-3.5" /></button>}
              </div>
              <Button type="button" className="h-9 shrink-0 rounded-xl" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New company</Button>
            </div>
          </div>
        ) : undefined}
      >
        <div className="mt-5 min-w-0 overflow-hidden rounded-xl border border-border bg-background">
          {shell.state === "loading" ? <TableSkeleton /> : shell.state === "error" ? <EmptyState title="We’re sorry, something went wrong" body="Please come back later and try again." /> : loadError ? <EmptyState title="Could not load companies" body={loadError} /> : (
            <PagedTable page={page} hasNext={hasNext} loading={loading} onPageChange={loadCompanies}>
              <CompaniesTable companies={filteredCompanies} lastTouchSort={lastTouchSort} onSortLastTouch={() => setLastTouchSort(toggleSort)} onSelect={setSelectedCompany} />
            </PagedTable>
          )}
        </div>
      </CrmRouteShell>

      <CreateCompanySheet open={createOpen} workspaceId={activeWorkspaceId} onOpenChange={setCreateOpen} onCreated={(company) => {
        setSelectedCompany(company);
        void loadCompanies(0);
      }} />

      <CompanySheet
        company={selectedCompany}
        onOpenChange={(open) => !open && setSelectedCompany(null)}
        people={linkedPeople}
        deals={linkedDeals}
        tasks={tasks}
        timeline={timeline}
        workspaceId={activeWorkspaceId}
        onActivityCreated={() => setDetailRefresh((value) => value + 1)}
        onTaskChanged={() => setDetailRefresh((value) => value + 1)}
        onSaved={(company) => {
          setSelectedCompany(company);
          void loadCompanies(page);
        }}
        onDeleted={() => {
          setSelectedCompany(null);
          void loadCompanies(0);
        }}
        onSelectPerson={() => undefined}
        onSelectDeal={() => undefined}
      />
    </>
  );
}

function CreateCompanySheet({ open, workspaceId, onOpenChange, onCreated }: { open: boolean; workspaceId: string; onOpenChange: (open: boolean) => void; onCreated: (company: Company) => void }) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState("");

  function close(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setName("");
      setDomain("");
      setError("");
    }
  }

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const company = await api.createCompany({ workspace_id: workspaceId || undefined, name, domain });
      close(false);
      onCreated(company);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create company");
    }
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>New company</SheetTitle><SheetDescription>Create a CRM account.</SheetDescription></SheetHeader>
        <form onSubmit={createCompany} className="mt-6 space-y-4">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Company name" required />
          <Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="Domain" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full">Create company</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

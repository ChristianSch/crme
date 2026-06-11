"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Search, X } from "lucide-react";

import { CrmRouteShell, LoginScreen, OrganizationGate, PagedTable, useLogout, useOrganizationSwitcher, usePersistedSidebar, usePersistedWorkspace } from "@/components/crm/crm-shared";
import { EmptyState, TableSkeleton } from "@/components/common/data-state";
import { DealSheet } from "@/components/sheets/deal-sheet";
import { DealsTable } from "@/components/tables/deals-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrmShell } from "@/hooks/use-crm-shell";
import { PAGE_SIZE } from "@/hooks/use-paged-list";
import { api, Company, Deal, Person, TimelineItem, Todo } from "@/lib/api";

const DEAL_STAGES = [
  { value: "new", label: "New" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

type RelationLoadState = "idle" | "loading" | "ready" | "error";

export function DealsView({ initialSidebarCollapsed = false, initialWorkspaceId = "all" }: { initialSidebarCollapsed?: boolean; initialWorkspaceId?: string }) {
  const shell = useCrmShell();
  const [workspaceId, setWorkspaceId] = usePersistedWorkspace(initialWorkspaceId);
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedSidebar(initialSidebarCollapsed);
  const setOrganizationId = useOrganizationSwitcher(shell.loadShell);
  const logout = useLogout(shell.loadShell);

  const [query, setQuery] = useState("");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [linkedPeople, setLinkedPeople] = useState<Person[]>([]);
  const [linkedCompanies, setLinkedCompanies] = useState<Company[]>([]);
  const [peopleOptions, setPeopleOptions] = useState<Person[]>([]);
  const [companyOptions, setCompanyOptions] = useState<Company[]>([]);
  const [dealTasks, setDealTasks] = useState<Todo[]>([]);
  const [relationState, setRelationState] = useState<RelationLoadState>("idle");
  const [relationRefresh, setRelationRefresh] = useState(0);

  const activeWorkspaceId = workspaceId === "all" ? "" : workspaceId;

  const loadDeals = useCallback(async (nextPage = 0) => {
    if (shell.state !== "ready") return;
    setLoadingDeals(true);
    setLoadError("");
    try {
      const next = await api.deals(query, activeWorkspaceId, PAGE_SIZE, nextPage * PAGE_SIZE);
      setDeals(next ?? []);
      setPage(nextPage);
      setHasNext((next ?? []).length === PAGE_SIZE);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load deals");
    } finally {
      setLoadingDeals(false);
    }
  }, [activeWorkspaceId, query, shell.state]);

  useEffect(() => {
    if (shell.state !== "ready") return;
    const timeout = window.setTimeout(() => {
      void loadDeals(0);
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [loadDeals, shell.state]);

  useEffect(() => {
    let cancelled = false;

    async function loadDealDetails() {
      if (!selectedDeal) {
        setTimeline([]);
        setLinkedPeople([]);
        setLinkedCompanies([]);
        setPeopleOptions([]);
        setCompanyOptions([]);
        setDealTasks([]);
        setRelationState("idle");
        return;
      }

      setRelationState("loading");
      try {
        const [items, nextLinkedPeople, nextLinkedCompanies, nextTasks, nextPeopleOptions, nextCompanyOptions] = await Promise.all([
          api.timeline("deal", selectedDeal.id),
          api.dealPeople(selectedDeal.id),
          api.dealCompanies(selectedDeal.id),
          api.tasks({ entity_type: "deal", entity_id: selectedDeal.id, limit: PAGE_SIZE, offset: 0 }),
          api.people("", activeWorkspaceId, PAGE_SIZE, 0),
          api.companies("", activeWorkspaceId, PAGE_SIZE, 0),
        ]);
        if (!cancelled) {
          setTimeline(items ?? []);
          setLinkedPeople(nextLinkedPeople ?? []);
          setLinkedCompanies(nextLinkedCompanies ?? []);
          setDealTasks(nextTasks ?? []);
          setPeopleOptions(nextPeopleOptions ?? []);
          setCompanyOptions(nextCompanyOptions ?? []);
          setRelationState("ready");
        }
      } catch {
        if (!cancelled) {
          setTimeline([]);
          setLinkedPeople([]);
          setLinkedCompanies([]);
          setDealTasks([]);
          setRelationState("error");
        }
      }
    }

    void loadDealDetails();
    return () => { cancelled = true; };
  }, [activeWorkspaceId, selectedDeal, relationRefresh]);

  const filteredDeals = useMemo(() => deals, [deals]);

  if (shell.state === "unauthorized") return <LoginScreen onRetry={shell.loadShell} />;
  if (shell.state === "needs-organization") return <OrganizationGate userEmail={shell.me?.user.email} organizations={shell.organizations} selectedOrganizationId={shell.selectedOrganizationId} onSelect={setOrganizationId} onCreated={(id) => void shell.loadShell(id)} />;

  return (
    <>
      <CrmRouteShell
        title="Deals"
        description="Pipeline, linked people, companies, activities, and tasks."
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
                <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search deals" placeholder="Search deals" className="h-9 rounded-xl bg-background pl-9 pr-9 shadow-none" />
                {query && (
                  <button type="button" aria-label="Clear search" className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" onClick={() => setQuery("")}> 
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <Button type="button" className="h-9 shrink-0 rounded-xl" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New deal</Button>
            </div>
          </div>
        ) : undefined}
      >
        <div className="mt-5 min-w-0 overflow-hidden rounded-xl border border-border bg-background">
          {shell.state === "loading" ? <TableSkeleton /> : shell.state === "error" ? <EmptyState title="We’re sorry, something went wrong" body="Please come back later and try again." /> : loadError ? <EmptyState title="Could not load deals" body={loadError} /> : (
            <PagedTable page={page} hasNext={hasNext} loading={loadingDeals} onPageChange={loadDeals}>
              <DealsTable deals={filteredDeals} onSelect={setSelectedDeal} />
            </PagedTable>
          )}
        </div>
      </CrmRouteShell>

      <CreateDealSheet open={createOpen} workspaceId={activeWorkspaceId} onOpenChange={setCreateOpen} onCreated={(deal) => {
        setSelectedDeal(deal);
        void loadDeals(0);
      }} />

      <DealSheet
        deal={selectedDeal}
        onOpenChange={(open) => !open && setSelectedDeal(null)}
        people={peopleOptions}
        companies={companyOptions}
        linkedPeople={linkedPeople}
        linkedCompanies={linkedCompanies}
        relationState={relationState}
        tasks={dealTasks}
        timeline={timeline}
        onRelationsChanged={() => setRelationRefresh((value) => value + 1)}
        onActivityCreated={() => setRelationRefresh((value) => value + 1)}
        onTaskChanged={() => setRelationRefresh((value) => value + 1)}
        onSelectPerson={() => undefined}
        onSelectCompany={() => undefined}
        onSaved={(deal) => {
          setSelectedDeal(deal);
          void loadDeals(page);
        }}
        onDeleted={() => {
          setSelectedDeal(null);
          void loadDeals(0);
        }}
      />
    </>
  );
}

function CreateDealSheet({ open, workspaceId, onOpenChange, onCreated }: { open: boolean; workspaceId: string; onOpenChange: (open: boolean) => void; onCreated: (deal: Deal) => void }) {
  const [name, setName] = useState("");
  const [stage, setStage] = useState("new");
  const [value, setValue] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState("");

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setName("");
      setStage("new");
      setValue("0");
      setCurrency("USD");
      setError("");
    }
  }

  async function createDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const deal = await api.createDeal({ workspace_id: workspaceId || undefined, name, stage, value_cents: Math.round(Number(value || 0) * 100), currency });
      handleOpenChange(false);
      onCreated(deal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create deal");
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New deal</SheetTitle>
          <SheetDescription>Create a pipeline opportunity.</SheetDescription>
        </SheetHeader>
        <form onSubmit={createDeal} className="mt-6 space-y-4">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Deal name" required />
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              {DEAL_STAGES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-[1fr_100px] gap-2">
            <Input value={value} onChange={(event) => setValue(event.target.value)} inputMode="decimal" placeholder="Value" />
            <Input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} placeholder="USD" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full">Create deal</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

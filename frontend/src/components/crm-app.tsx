"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  LinkIcon,
  LogOut,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Toast, ToastClose, ToastProvider, ToastViewport } from "@/components/ui/toast";
import { AppShell } from "@/components/app/app-shell";
import { CommandPalette, type CreateRecordType } from "@/components/app/command-palette";
import { ConfirmAction } from "@/components/common/confirm-action";
import { EmptyState, TableSkeleton } from "@/components/common/data-state";
import { CompanySheet } from "@/components/sheets/company-sheet";
import { DealSheet } from "@/components/sheets/deal-sheet";
import { PersonSheet } from "@/components/sheets/person-sheet";
import { TaskSheet } from "@/components/sheets/task-sheet";
import { CompaniesTable } from "@/components/tables/companies-table";
import { DealsTable } from "@/components/tables/deals-table";
import { PeopleTable } from "@/components/tables/people-table";
import { TasksTable } from "@/components/tables/tasks-table";
import { type AppView } from "@/components/app/sidebar-nav";
import { AssistantPopover } from "@/components/assistant/assistant-popover";
import { SuggestionsPanel, type SuggestionUndo, clearStoredSuggestionUndo, readStoredSuggestionUndo } from "@/components/suggestions/suggestions-panel";
import { WorkspaceFilter } from "@/components/workspace-filter";
import { useCrmData } from "@/hooks/use-crm-data";
import { api, AuditLog, Company, Deal, EmailAccount, fullName, OrganizationInvitation, OrganizationMember, OrganizationMembership, Person, setSelectedOrganizationId, Suggestion, TimelineItem, Todo } from "@/lib/api";
import { compareDates, firstUsefulLine, linkedEntityLabel, relativeDate, searchable, shortDate, toggleSort, type SortDirection } from "@/lib/format";
import { cn } from "@/lib/utils";

type View = AppView;

type RelationLoadState = "idle" | "loading" | "ready" | "error";

const TASK_PRIORITIES: Array<{ value: Todo["priority"]; label: string }> = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

const DEAL_STAGES = [
  { value: "new", label: "New" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export function CrmApp({ view, initialSidebarCollapsed = false, initialWorkspaceId = "all" }: { view: View; initialSidebarCollapsed?: boolean; initialWorkspaceId?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState<"open" | "done" | "all">("all");
  const [taskDueFilter, setTaskDueFilter] = useState<"today" | "overdue" | "upcoming" | "none" | "all">("all");
  const [workspaceId, setWorkspaceIdState] = useState<string>(initialWorkspaceId);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(initialSidebarCollapsed);
  const { state, loadData, me, organizations, selectedOrganizationId, workspaces, people, companies, tasks, deals, suggestions, peoplePage, companiesPage, tasksPage, dealsPage, loadPeople, loadCompanies, loadTasks, loadDeals, setTasks } = useCrmData();
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedTask, setSelectedTask] = useState<Todo | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [createType, setCreateType] = useState<CreateRecordType | null>(null);
  const [selectedPersonCompanies, setSelectedPersonCompanies] = useState<Company[]>([]);
  const [selectedCompanyPeople, setSelectedCompanyPeople] = useState<Person[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [companyTimeline, setCompanyTimeline] = useState<TimelineItem[]>([]);
  const [dealTimeline, setDealTimeline] = useState<TimelineItem[]>([]);
  const [selectedDealPeople, setSelectedDealPeople] = useState<Person[]>([]);
  const [selectedDealCompanies, setSelectedDealCompanies] = useState<Company[]>([]);
  const [dealRelationState, setDealRelationState] = useState<RelationLoadState>("idle");
  const [relationRefresh, setRelationRefresh] = useState(0);
  const [lastTouchSort, setLastTouchSort] = useState<SortDirection>("desc");
  const [undo, setUndo] = useState<SuggestionUndo | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [membersState, setMembersState] = useState<RelationLoadState>("idle");
  const [membersError, setMembersError] = useState("");
  const [settingsToast, setSettingsToast] = useState("");
  const skippedInitialDefaultReload = useRef(false);

  function openPerson(person: Person) {
    setSelectedPerson(person);
  }

  function openCompany(company: Company) {
    setSelectedCompany(company);
  }

  function openDeal(deal: Deal) {
    setSelectedDeal(deal);
  }

  async function logout() {
    await api.logout();
    router.refresh();
    void loadData();
  }

  useEffect(() => {
    queueMicrotask(() => setUndo(readStoredSuggestionUndo()));
  }, []);

  function setWorkspaceId(value: string) {
    setWorkspaceIdState(value);
    document.cookie = `crme_workspace_id=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
  }

  function setOrganizationId(value: string) {
    setSelectedOrganizationId(value);
    void loadData(value);
  }

  function setSidebarCollapsed(value: boolean) {
    setSidebarCollapsedState(value);
    document.cookie = `crme_sidebar_collapsed=${String(value)}; path=/; max-age=31536000; samesite=lax`;
  }

  useEffect(() => {
    if (state !== "ready") return;
    const isDefaultList = query === "" && workspaceId === "all" && taskStatusFilter === "all" && taskDueFilter === "all";
    if (isDefaultList && !skippedInitialDefaultReload.current) {
      skippedInitialDefaultReload.current = true;
      return;
    }
    const activeWorkspaceId = workspaceId === "all" ? "" : workspaceId;
    const timeout = window.setTimeout(() => {
      if (view === "people") void loadPeople(query, activeWorkspaceId, 0);
      if (view === "companies") void loadCompanies(query, activeWorkspaceId, 0);
      if (view === "deals") void loadDeals(query, activeWorkspaceId, 0);
      if (view === "tasks") void loadTasks(query, activeWorkspaceId, 0, taskStatusFilter, taskDueFilter);
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [loadCompanies, loadDeals, loadPeople, loadTasks, query, state, taskDueFilter, taskStatusFilter, view, workspaceId]);

  useEffect(() => {
    let cancelled = false;

    async function loadMembers() {
      if (view !== "settings" || !selectedOrganizationId) return;
      setMembersState("loading");
      setMembersError("");
      try {
        const canManage = organizations.find((org) => org.organization_id === selectedOrganizationId)?.role;
        const [next, nextInvitations, nextAccounts, nextAuditLogs] = await Promise.all([
          api.organizationMembers(selectedOrganizationId),
          api.organizationInvitations(selectedOrganizationId),
          api.emailAccounts(),
          canManage === "owner" || canManage === "admin" ? api.auditLogs() : Promise.resolve([]),
        ]);
        if (!cancelled) {
          setMembers(next ?? []);
          setInvitations(nextInvitations ?? []);
          setEmailAccounts(nextAccounts ?? []);
          setAuditLogs(nextAuditLogs ?? []);
          setMembersState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setMembers([]);
          setEmailAccounts([]);
          setAuditLogs([]);
          setMembersError(error instanceof Error ? error.message : "Could not load settings");
          setMembersState("error");
        }
      }
    }

    void loadMembers();
    return () => { cancelled = true; };
  }, [organizations, selectedOrganizationId, view]);

  async function refreshMembers() {
    if (!selectedOrganizationId) return;
    const canManage = organizations.find((org) => org.organization_id === selectedOrganizationId)?.role;
    const [next, nextInvitations, nextAccounts, nextAuditLogs] = await Promise.all([
      api.organizationMembers(selectedOrganizationId),
      api.organizationInvitations(selectedOrganizationId),
      api.emailAccounts(),
      canManage === "owner" || canManage === "admin" ? api.auditLogs() : Promise.resolve([]),
    ]);
    setMembers(next ?? []);
    setInvitations(nextInvitations ?? []);
    setEmailAccounts(nextAccounts ?? []);
    setAuditLogs(nextAuditLogs ?? []);
    setMembersState("ready");
    setMembersError("");
  }

  useEffect(() => {
    let cancelled = false;

    async function loadTimeline() {
      if (!selectedPerson) {
        setTimeline([]);
        setSelectedPersonCompanies([]);
        return;
      }
      try {
        const [items, linkedCompanies] = await Promise.all([
          api.timeline("person", selectedPerson.id),
          api.personCompanies(selectedPerson.id),
        ]);
        if (!cancelled) {
          setTimeline(items ?? []);
          setSelectedPersonCompanies(linkedCompanies ?? []);
        }
      } catch {
        if (!cancelled) {
          setTimeline([]);
          setSelectedPersonCompanies([]);
        }
      }
    }

    loadTimeline();
    return () => {
      cancelled = true;
    };
  }, [selectedPerson, relationRefresh]);

  useEffect(() => {
    let cancelled = false;

    async function loadCompanyTimeline() {
      if (!selectedCompany) {
        setCompanyTimeline([]);
        setSelectedCompanyPeople([]);
        return;
      }
      try {
        const [items, linkedPeople] = await Promise.all([
          api.timeline("company", selectedCompany.id),
          api.companyPeople(selectedCompany.id),
        ]);
        if (!cancelled) {
          setCompanyTimeline(items ?? []);
          setSelectedCompanyPeople(linkedPeople ?? []);
        }
      } catch {
        if (!cancelled) {
          setCompanyTimeline([]);
          setSelectedCompanyPeople([]);
        }
      }
    }

    loadCompanyTimeline();
    return () => {
      cancelled = true;
    };
  }, [selectedCompany, relationRefresh]);

  useEffect(() => {
    let cancelled = false;

    async function loadDealTimeline() {
      if (!selectedDeal) {
        setDealTimeline([]);
        setSelectedDealPeople([]);
        setSelectedDealCompanies([]);
        setDealRelationState("idle");
        return;
      }
      setDealRelationState("loading");
      try {
        const [items, linkedPeople, linkedCompanies] = await Promise.all([
          api.timeline("deal", selectedDeal.id),
          api.dealPeople(selectedDeal.id),
          api.dealCompanies(selectedDeal.id),
        ]);
        if (!cancelled) {
          setDealTimeline(items ?? []);
          setSelectedDealPeople(linkedPeople ?? []);
          setSelectedDealCompanies(linkedCompanies ?? []);
          setDealRelationState("ready");
        }
      } catch {
        if (!cancelled) {
          setDealTimeline([]);
          setSelectedDealPeople([]);
          setSelectedDealCompanies([]);
          setDealRelationState("error");
        }
      }
    }

    loadDealTimeline();
    return () => {
      cancelled = true;
    };
  }, [selectedDeal, relationRefresh]);

  const filteredPeople = useMemo(() => {
    return [...people].sort((a, b) => compareDates(a.last_touch_at, b.last_touch_at, lastTouchSort));
  }, [people, lastTouchSort]);

  const filteredCompanies = useMemo(() => {
    return [...companies].sort((a, b) => compareDates(a.last_touch_at, b.last_touch_at, lastTouchSort));
  }, [companies, lastTouchSort]);

  const filteredDeals = deals;
  const filteredTasks = tasks;
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((suggestion) => searchable([suggestion.title, suggestion.body, suggestion.kind, suggestion.entity_type, suggestion.status], query));
  }, [query, suggestions]);

  const currentTitle = {
    dashboard: "Dashboard",
    companies: "Companies",
    people: "People",
    deals: "Deals",
    tasks: "Tasks",
    suggestions: "Suggestions",
    settings: "Settings",
  }[view];

  const currentDescription = {
    dashboard: "Open work and CRM prompts that need attention.",
    companies: "Accounts, domains, and last touch points.",
    people: "Contacts, owners, and follow-up context.",
    deals: "Pipeline, linked people, companies, activities, and tasks.",
    tasks: "Open work sorted by urgency and relationship.",
    suggestions: "Review proposed CRM updates and approve the useful ones.",
    settings: "Team access, roles, and invitations.",
  }[view];

  const createForView = createRecordForView(view);

  if (state === "unauthorized") return <LoginScreen onRetry={loadData} />;
  if (state === "needs-organization") return <OrganizationGate userEmail={me?.user.email} organizations={organizations} selectedOrganizationId={selectedOrganizationId} onSelect={setOrganizationId} onCreated={(id) => void loadData(id)} />;

  return (
    <>
      <AppShell
        title={currentTitle}
        description={currentDescription}
        sidebarCollapsed={sidebarCollapsed}
        onSidebarCollapsedChange={setSidebarCollapsed}
        headerActions={(
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <OrganizationSelect organizations={organizations} value={selectedOrganizationId} onChange={setOrganizationId} />
            <WorkspaceFilter value={workspaceId} workspaces={workspaces} onChange={setWorkspaceId} />
            <AccountMenu onLogout={logout} />
          </div>
        )}
        controls={view === "settings" ? undefined : (
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            <CommandPalette
              workspaceId={workspaceId}
              onSelectPerson={openPerson}
              onSelectCompany={openCompany}
              onSelectDeal={openDeal}
              onSelectTask={setSelectedTask}
              onCreate={setCreateType}
            />
            <div className="flex w-full flex-col gap-2 sm:flex-row md:max-w-[520px]">
              {view !== "dashboard" && <div className="relative w-full md:max-w-[360px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Search CRM"
                  placeholder="Search name, email, domain"
                  className="h-9 rounded-xl bg-background pl-9 pr-9 shadow-none"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    onClick={() => setQuery("")}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>}
              {view === "tasks" && (
                <div className="flex gap-2">
                  <Select value={taskStatusFilter} onValueChange={(value) => setTaskStatusFilter(value as "open" | "done" | "all")}>
                    <SelectTrigger className="h-9 w-[118px] rounded-xl bg-background shadow-none"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent align="start" position="popper" className="rounded-xl p-1">
                      <SelectItem value="all" className="rounded-lg">All status</SelectItem>
                      <SelectItem value="open" className="rounded-lg">Open</SelectItem>
                      <SelectItem value="done" className="rounded-lg">Done</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={taskDueFilter} onValueChange={(value) => setTaskDueFilter(value as "today" | "overdue" | "upcoming" | "none" | "all")}>
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
              )}
              {createForView && (
                <Button type="button" className="h-9 shrink-0 rounded-xl" onClick={() => setCreateType(createForView.type)}>
                  <Plus className="size-3.5" /> {createForView.label}
                </Button>
              )}
            </div>
          </div>
        )}
      >
        <div className="mt-5 min-w-0 overflow-hidden rounded-xl border border-border bg-background">
            {state === "loading" ? (
              <TableSkeleton />
            ) : state === "error" ? (
              <EmptyState title="We’re sorry, something went wrong" body="Please come back later and try again." />
            ) : view === "settings" ? (
              <SettingsPanel
                organization={organizations.find((org) => org.organization_id === selectedOrganizationId)}
                members={members}
                invitations={invitations}
                emailAccounts={emailAccounts}
                auditLogs={auditLogs}
                state={membersState}
                error={membersError}
                onRefresh={refreshMembers}
                onToast={setSettingsToast}
              />
            ) : view === "people" ? (
              <PagedTable page={peoplePage.page} hasNext={peoplePage.hasNext} loading={peoplePage.loading} onPageChange={(page) => loadPeople(query, workspaceId === "all" ? "" : workspaceId, page)}>
                <PeopleTable people={filteredPeople} lastTouchSort={lastTouchSort} onSortLastTouch={() => setLastTouchSort(toggleSort)} onSelect={openPerson} />
              </PagedTable>
            ) : view === "companies" ? (
              <PagedTable page={companiesPage.page} hasNext={companiesPage.hasNext} loading={companiesPage.loading} onPageChange={(page) => loadCompanies(query, workspaceId === "all" ? "" : workspaceId, page)}>
                <CompaniesTable companies={filteredCompanies} lastTouchSort={lastTouchSort} onSortLastTouch={() => setLastTouchSort(toggleSort)} onSelect={openCompany} />
              </PagedTable>
            ) : view === "deals" ? (
              <PagedTable page={dealsPage.page} hasNext={dealsPage.hasNext} loading={dealsPage.loading} onPageChange={(page) => loadDeals(query, workspaceId === "all" ? "" : workspaceId, page)}>
                <DealsTable deals={filteredDeals} onSelect={openDeal} />
              </PagedTable>
            ) : view === "tasks" ? (
              <PagedTable page={tasksPage.page} hasNext={tasksPage.hasNext} loading={tasksPage.loading} onPageChange={(page) => loadTasks(query, workspaceId === "all" ? "" : workspaceId, page, taskStatusFilter, taskDueFilter)}>
                <TasksTable tasks={filteredTasks} people={people} companies={companies} deals={deals} onSelect={setSelectedTask} onSelectPerson={openPerson} onSelectCompany={openCompany} onSelectDeal={openDeal} />
              </PagedTable>
            ) : view === "suggestions" ? (
              <SuggestionsPanel suggestions={filteredSuggestions} people={people} companies={companies} onChanged={loadData} onUndo={setUndo} />
            ) : (
              <DashboardPanel tasks={filteredTasks} suggestions={suggestions} people={people} companies={companies} deals={deals} onSelectTask={setSelectedTask} onSelectPerson={openPerson} onSelectCompany={openCompany} onSelectDeal={openDeal} onOpenTasks={() => router.push("/tasks")} onOpenSuggestions={() => router.push("/suggestions")} />
            )}
        </div>
      </AppShell>

      <PersonSheet
        person={selectedPerson}
        onOpenChange={(open) => !open && setSelectedPerson(null)}
        companies={selectedPersonCompanies}
        allCompanies={companies}
        workspaceId={workspaceId === "all" ? "" : workspaceId}
        tasks={tasks}
        timeline={timeline}
        onSaved={(person) => {
          setSelectedPerson(person);
          void loadData();
        }}
        onDeleted={() => {
          setSelectedPerson(null);
          void loadData();
        }}
        onCompaniesChanged={async () => {
          await loadData();
          setRelationRefresh((value) => value + 1);
        }}
        onActivityCreated={() => setRelationRefresh((value) => value + 1)}
        onTaskChanged={() => {
          void loadData();
          setRelationRefresh((value) => value + 1);
        }}
      />
      <CompanySheet
        company={selectedCompany}
        onOpenChange={(open) => !open && setSelectedCompany(null)}
        people={selectedCompanyPeople}
        tasks={tasks}
        workspaceId={workspaceId}
        timeline={companyTimeline}
        onActivityCreated={() => setRelationRefresh((value) => value + 1)}
        onTaskChanged={() => {
          void loadData();
          setRelationRefresh((value) => value + 1);
        }}
        onSaved={(company) => {
          setSelectedCompany(company);
          void loadData();
        }}
        onDeleted={() => {
          setSelectedCompany(null);
          void loadData();
        }}
        onSelectPerson={openPerson}
      />
      <DealSheet
        deal={selectedDeal}
        onOpenChange={(open) => !open && setSelectedDeal(null)}
        people={people}
        companies={companies}
        linkedPeople={selectedDealPeople}
        linkedCompanies={selectedDealCompanies}
        relationState={dealRelationState}
        tasks={tasks}
        timeline={dealTimeline}
        onRelationsChanged={() => setRelationRefresh((value) => value + 1)}
        onActivityCreated={() => setRelationRefresh((value) => value + 1)}
        onTaskChanged={loadData}
        onSelectPerson={setSelectedPerson}
        onSelectCompany={setSelectedCompany}
        onSaved={(deal) => {
          setSelectedDeal(deal);
          void loadData();
        }}
        onDeleted={() => {
          setSelectedDeal(null);
          void loadData();
        }}
      />
      <TaskSheet
        task={selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        people={people}
        companies={companies}
        deals={deals}
        workspaceId={workspaceId === "all" ? "" : workspaceId}
        onTaskChanged={(task) => {
          setSelectedTask(task);
          setTasks((current) => current.map((item) => item.id === task.id ? task : item));
          setRelationRefresh((value) => value + 1);
          void loadTasks(query, workspaceId === "all" ? "" : workspaceId, tasksPage.page, taskStatusFilter, taskDueFilter);
        }}
        onDeleted={() => {
          setSelectedTask(null);
          void loadTasks(query, workspaceId === "all" ? "" : workspaceId, tasksPage.page, taskStatusFilter, taskDueFilter);
        }}
        onSelectPerson={setSelectedPerson}
        onSelectCompany={setSelectedCompany}
        onSelectDeal={setSelectedDeal}
      />
      <CreateRecordSheet
        key={createType ?? "closed"}
        type={createType}
        workspaceId={workspaceId === "all" ? "" : workspaceId}
        onOpenChange={(open) => !open && setCreateType(null)}
        onCreated={(record) => {
          setCreateType(null);
          void loadData();
          if (record.kind === "person") setSelectedPerson(record.value);
          if (record.kind === "company") setSelectedCompany(record.value);
          if (record.kind === "deal") setSelectedDeal(record.value);
          if (record.kind === "task") setSelectedTask(record.value);
        }}
      />
      <AssistantPopover selectedSuggestion={view === "suggestions" ? suggestions[0] : undefined} onChanged={loadData} onSelectPerson={openPerson} onSelectCompany={openCompany} onSelectDeal={openDeal} onSelectTask={setSelectedTask} />
      {undo && <UndoToast key={undo.suggestionId} undo={undo} onDone={loadData} onClose={() => { clearStoredSuggestionUndo(); setUndo(null); }} />}
      {settingsToast && <PlainToast message={settingsToast} onClose={() => setSettingsToast("")} />}
    </>
  );
}

type CreatedRecord =
  | { kind: "person"; value: Person }
  | { kind: "company"; value: Company }
  | { kind: "deal"; value: Deal }
  | { kind: "task"; value: Todo };

function createRecordForView(view: View): { type: CreateRecordType; label: string } | null {
  if (view === "dashboard") return { type: "task", label: "New task" };
  if (view === "people") return { type: "person", label: "New person" };
  if (view === "companies") return { type: "company", label: "New company" };
  if (view === "deals") return { type: "deal", label: "New deal" };
  if (view === "tasks") return { type: "task", label: "New task" };
  return null;
}

function CreateRecordSheet({ type, workspaceId, onOpenChange, onCreated }: { type: CreateRecordType | null; workspaceId: string; onOpenChange: (open: boolean) => void; onCreated: (record: CreatedRecord) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [person, setPerson] = useState({ first_name: "", last_name: "", email: "", title: "" });
  const [company, setCompany] = useState({ name: "", domain: "" });
  const [deal, setDeal] = useState({ name: "", stage: "new", value: "0", currency: "USD" });
  const [task, setTask] = useState({ title: "", body: "", dueDate: "", priority: "normal" as Todo["priority"] });
  const activeWorkspaceId = workspaceId === "all" ? undefined : workspaceId || undefined;

  function resetDrafts() {
    setSaving(false);
    setError("");
    setPerson({ first_name: "", last_name: "", email: "", title: "" });
    setCompany({ name: "", domain: "" });
    setDeal({ name: "", stage: "new", value: "0", currency: "USD" });
    setTask({ title: "", body: "", dueDate: "", priority: "normal" });
  }

  function handleOpenChange(open: boolean) {
    if (!open) resetDrafts();
    onOpenChange(open);
  }

  function finishCreated(record: CreatedRecord) {
    resetDrafts();
    onCreated(record);
  }

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type) return;
    setSaving(true);
    setError("");
    try {
      if (type === "person") {
        const saved = await api.createPerson({
          first_name: person.first_name.trim(),
          last_name: person.last_name.trim(),
          email: person.email.trim(),
          title: person.title.trim(),
          workspace_id: activeWorkspaceId,
          status: "active",
        });
        finishCreated({ kind: "person", value: saved });
      }
      if (type === "company") {
        const saved = await api.createCompany({ name: company.name.trim(), domain: company.domain.trim(), workspace_id: activeWorkspaceId });
        finishCreated({ kind: "company", value: saved });
      }
      if (type === "deal") {
        const saved = await api.createDeal({
          workspace_id: activeWorkspaceId,
          name: deal.name.trim(),
          stage: deal.stage,
          value_cents: Math.round((Number.parseFloat(deal.value) || 0) * 100),
          currency: deal.currency.trim().toUpperCase().slice(0, 3) || "USD",
        });
        finishCreated({ kind: "deal", value: saved });
      }
      if (type === "task") {
        const saved = await api.createTask({
          workspace_id: activeWorkspaceId,
          title: task.title.trim(),
          body: task.body.trim(),
          due_at: task.dueDate ? new Date(`${task.dueDate}T12:00:00`).toISOString() : undefined,
          priority: task.priority,
          status: "open",
        });
        finishCreated({ kind: "task", value: saved });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create record");
    } finally {
      setSaving(false);
    }
  }

  const title = type === "person" ? "New person" : type === "company" ? "New company" : type === "deal" ? "New deal" : "New task";
  const description = type === "person" ? "Add a contact. Email is optional; first or last name is required." : type === "task" ? "Capture follow-up work. You can link it to a record after creation." : "Create the record, then add relationships and activity from its sheet.";
  const canSave = type === "person" ? Boolean(person.first_name.trim() || person.last_name.trim()) : type === "company" ? Boolean(company.name.trim()) : type === "deal" ? Boolean(deal.name.trim()) : type === "task" ? Boolean(task.title.trim() || task.body.trim()) : false;

  return (
    <Sheet open={Boolean(type)} onOpenChange={handleOpenChange}>
      <SheetContent className="!w-[min(100vw,520px)] !max-w-none overflow-hidden p-0">
        <form onSubmit={createRecord} className="flex h-full flex-col bg-[oklch(0.985_0.004_255)]">
          <SheetHeader className="border-b py-6 pl-6 pr-16 text-left">
            <SheetTitle className="text-xl tracking-[-0.025em]">{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {type === "person" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <LabeledInput label="First name" value={person.first_name} onChange={(value) => setPerson((current) => ({ ...current, first_name: value }))} autoFocus placeholder="Required if no last name" />
                <LabeledInput label="Last name" value={person.last_name} onChange={(value) => setPerson((current) => ({ ...current, last_name: value }))} placeholder="Required if no first name" />
                <LabeledInput label="Email" type="email" value={person.email} onChange={(value) => setPerson((current) => ({ ...current, email: value }))} placeholder="Optional" />
                <LabeledInput label="Role" value={person.title} onChange={(value) => setPerson((current) => ({ ...current, title: value }))} />
              </div>
            )}
            {type === "company" && (
              <div className="grid gap-3">
                <LabeledInput label="Company name" value={company.name} onChange={(value) => setCompany((current) => ({ ...current, name: value }))} autoFocus />
                <LabeledInput label="Domain" value={company.domain} onChange={(value) => setCompany((current) => ({ ...current, domain: value }))} placeholder="example.com" />
              </div>
            )}
            {type === "deal" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <LabeledInput label="Deal name" value={deal.name} onChange={(value) => setDeal((current) => ({ ...current, name: value }))} autoFocus />
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Stage</label>
                  <Select value={deal.stage} onValueChange={(value) => setDeal((current) => ({ ...current, stage: value }))}>
                    <SelectTrigger className="h-9 rounded-xl bg-background shadow-none"><SelectValue placeholder="Stage" /></SelectTrigger>
                    <SelectContent align="start" position="popper" className="rounded-xl p-1">
                      {DEAL_STAGES.map((option) => <SelectItem key={option.value} value={option.value} className="rounded-lg py-2 pl-3 pr-8">{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <LabeledInput label="Value" value={deal.value} onChange={(value) => setDeal((current) => ({ ...current, value }))} inputMode="decimal" />
                <LabeledInput label="Currency" value={deal.currency} onChange={(value) => setDeal((current) => ({ ...current, currency: value }))} maxLength={3} />
              </div>
            )}
            {type === "task" && (
              <div className="grid gap-3">
                <LabeledInput label="Task title" value={task.title} onChange={(value) => setTask((current) => ({ ...current, title: value }))} autoFocus />
                <div className="grid gap-3 sm:grid-cols-2">
                  <LabeledInput label="Due date" type="date" value={task.dueDate} onChange={(value) => setTask((current) => ({ ...current, dueDate: value }))} />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
                    <Select value={task.priority} onValueChange={(value) => setTask((current) => ({ ...current, priority: value as Todo["priority"] }))}>
                      <SelectTrigger className="h-9 rounded-xl bg-background shadow-none"><SelectValue placeholder="Priority" /></SelectTrigger>
                      <SelectContent align="start" position="popper" className="rounded-xl p-1">
                        {TASK_PRIORITIES.map((option) => <SelectItem key={option.value} value={option.value} className="rounded-lg py-2 pl-3 pr-8">{option.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Details</label>
                  <Textarea value={task.body} onChange={(event) => setTask((current) => ({ ...current, body: event.target.value }))} className="min-h-28 rounded-xl bg-background" />
                </div>
              </div>
            )}
            {error && <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={saving} onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="h-9 rounded-xl" disabled={saving || !canSave}>{saving ? "Creating..." : title}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function LabeledInput({ label, value, onChange, ...props }: { label: string; value: string; onChange: (value: string) => void } & Omit<ComponentProps<typeof Input>, "value" | "onChange">) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-xl bg-background" {...props} />
    </div>
  );
}

function SettingsPanel({ organization, members, invitations, emailAccounts, auditLogs, state, error, onRefresh, onToast }: { organization?: OrganizationMembership; members: OrganizationMember[]; invitations: OrganizationInvitation[]; emailAccounts: EmailAccount[]; auditLogs: AuditLog[]; state: RelationLoadState; error: string; onRefresh: () => Promise<void>; onToast: (message: string) => void }) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [busyMemberId, setBusyMemberId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const emptyEmailForm = { name: "", email: "", imap_host: "", imap_port: "993", imap_username: "", smtp_host: "", smtp_port: "587", smtp_username: "", secret: "" };
  const [emailForm, setEmailForm] = useState(emptyEmailForm);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTestState, setEmailTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [emailTestMessage, setEmailTestMessage] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [editingEmailAccountId, setEditingEmailAccountId] = useState("");
  const [editingEmailAccount, setEditingEmailAccount] = useState<(EmailAccount & { secret?: string }) | null>(null);
  const canManage = organization?.role === "owner" || organization?.role === "admin";

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    setInviting(true);
    setMessage("");
    try {
      await api.inviteOrganizationMember(organization.organization_id, inviteEmail, inviteRole);
      setInviteEmail("");
      await onRefresh();
      onToast("Invitation sent.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not send invitation");
    } finally {
      setInviting(false);
    }
  }

  async function updateRole(member: OrganizationMember, role: string) {
    if (!organization) return;
    setBusyMemberId(member.user_id);
    setMessage("");
    try {
      await api.updateOrganizationMemberRole(organization.organization_id, member.user_id, role);
      await onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update role");
    } finally {
      setBusyMemberId("");
    }
  }

  async function resendInvitation(invitation: OrganizationInvitation) {
    if (!organization || !invitation.id) return;
    setBusyMemberId(invitation.id);
    setMessage("");
    try {
      await api.resendOrganizationInvitation(organization.organization_id, invitation.id);
      await onRefresh();
      onToast("Invitation resent.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not resend invitation");
    } finally {
      setBusyMemberId("");
    }
  }

  async function removeMember(member: OrganizationMember) {
    if (!organization) return;
    setBusyMemberId(member.user_id);
    setMessage("");
    try {
      await api.removeOrganizationMember(organization.organization_id, member.user_id);
      await onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not remove member");
    } finally {
      setBusyMemberId("");
    }
  }

  function emailPayload() {
    return { ...emailForm, imap_port: Number(emailForm.imap_port) || 993, smtp_port: Number(emailForm.smtp_port) || 587, sync_enabled: true };
  }

  function emailError(err: unknown, fallback: string) {
    const message = err instanceof Error ? err.message.trim() : "";
    if (!message) return fallback;
    if (message === "internal server error" || message.includes("runtime secret storage is not configured")) {
      return "Email password storage is not configured. Set CRME_SECRET_KEY on the API server and restart it.";
    }
    return message.replace(/^validation error:\s*/i, "");
  }

  async function testEmailAccount() {
    setEmailTestState("testing");
    setEmailTestMessage("");
    try {
      await api.testEmailAccount(emailPayload());
      setEmailTestState("success");
      setEmailTestMessage("Connection test succeeded.");
    } catch (err) {
      setEmailTestState("error");
      setEmailTestMessage(emailError(err, "Connection test failed"));
    }
  }

  async function saveEmailAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emailTestState !== "success") return;
    setSavingEmail(true);
    setEmailMessage("");
    try {
      await api.createEmailAccount(emailPayload());
      setEmailForm(emptyEmailForm);
      setEmailTestState("idle");
      setEmailTestMessage("");
      setEmailModalOpen(false);
      await onRefresh();
      onToast("Email integration added.");
    } catch (err) {
      setEmailMessage(emailError(err, "Could not save email integration"));
    } finally {
      setSavingEmail(false);
    }
  }

  async function saveEmailAccountEdit(account: EmailAccount) {
    if (!editingEmailAccount) return;
    setBusyMemberId(account.id);
    setEmailMessage("");
    try {
      await api.updateEmailAccount(account.id, editingEmailAccount);
      setEditingEmailAccountId("");
      setEditingEmailAccount(null);
      await onRefresh();
      onToast("Email integration updated.");
    } catch (err) {
      setEmailMessage(emailError(err, "Could not update email integration"));
    } finally {
      setBusyMemberId("");
    }
  }

  async function setEmailSync(account: EmailAccount, syncEnabled: boolean) {
    setBusyMemberId(account.id);
    setEmailMessage("");
    try {
      await api.updateEmailAccount(account.id, { ...account, sync_enabled: syncEnabled });
      await onRefresh();
    } catch (err) {
      setEmailMessage(emailError(err, "Could not update email integration"));
    } finally {
      setBusyMemberId("");
    }
  }

  async function deleteEmailAccount(account: EmailAccount) {
    setBusyMemberId(account.id);
    setEmailMessage("");
    try {
      await api.deleteEmailAccount(account.id);
      await onRefresh();
      onToast("Email integration removed.");
    } catch (err) {
      setEmailMessage(emailError(err, "Could not remove email integration"));
    } finally {
      setBusyMemberId("");
    }
  }

  return (
    <div className="divide-y divide-border">
      <section className="grid gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-6">
        <div>
          <h2 className="text-sm font-semibold">Team</h2>
          <p className="mt-1 text-sm text-muted-foreground">The active organization for shared CRM data.</p>
        </div>
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="text-sm font-medium">{organization?.name ?? "No team selected"}</div>
          <div className="mt-1 text-sm text-muted-foreground">Your role: <span className="capitalize text-foreground">{organization?.role ?? "unknown"}</span></div>
        </div>
      </section>

      <section className="grid gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-6">
        <div>
          <h2 className="text-sm font-semibold">Members</h2>
          <p className="mt-1 text-sm text-muted-foreground">Owners and admins can change roles or remove access.</p>
        </div>
        <div className="overflow-hidden rounded-xl border">
          {state === "loading" ? (
            <div className="p-4 text-sm text-muted-foreground">Loading members...</div>
          ) : state === "error" ? (
            <div className="p-4 text-sm text-destructive">{error}</div>
          ) : members.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No members found.</div>
          ) : (
            <div className="divide-y divide-border">
              {members.map((member) => {
                const isLastOwner = member.role === "owner" && members.filter((item) => item.role === "owner").length <= 1;
                return (
                <div key={member.user_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{member.email}</div>
                    <div className="text-xs text-muted-foreground">Current role: <span className="capitalize">{member.role}</span></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={member.role} disabled={!canManage || isLastOwner || busyMemberId === member.user_id} onValueChange={(role) => updateRole(member, role)}>
                      <SelectTrigger aria-label={`Role for ${member.email}`} className="h-9 w-32 rounded-xl bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end" className="rounded-xl">
                        {ORG_ROLES.map((role) => <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <ConfirmAction
                      trigger={<Button variant="outline" className="h-9 rounded-xl bg-background" disabled={!canManage || isLastOwner || busyMemberId === member.user_id}>Remove</Button>}
                      title="Remove member?"
                      description={`${member.email} will lose access to this team.`}
                      actionLabel="Remove"
                      onConfirm={() => removeMember(member)}
                    />
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-6">
        <div>
          <h2 className="text-sm font-semibold">Email integrations</h2>
          <p className="mt-1 text-sm text-muted-foreground">Connect and manage your own mailbox. Admins cannot see other users&apos; email accounts.</p>
        </div>
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button type="button" className="h-9 rounded-xl" onClick={() => { setEmailForm(emptyEmailForm); setEmailTestState("idle"); setEmailTestMessage(""); setEmailMessage(""); setEmailModalOpen(true); }}>Add email integration</Button>
          </div>
          <div className="overflow-hidden rounded-xl border">
            {emailAccounts.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No email integrations yet.</div> : (
              <div className="divide-y divide-border">
                {emailAccounts.map((account) => {
                  const editingName = editingEmailAccountId === account.id;
                  return (
                    <div key={account.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        {editingName && editingEmailAccount ? (
                          <div className="grid gap-2 md:grid-cols-2">
                            <Input value={editingEmailAccount.name || ""} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, name: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="Email integration name" placeholder="Name" />
                            <Input value={editingEmailAccount.email || ""} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, email: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="Email address" placeholder="Email address" />
                            <Input value={editingEmailAccount.imap_host || ""} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, imap_host: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="IMAP host" placeholder="IMAP host" />
                            <Input value={String(editingEmailAccount.imap_port || 993)} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, imap_port: Number(event.target.value) || 993 })} className="h-9 rounded-xl bg-background" aria-label="IMAP port" placeholder="IMAP port" />
                            <Input value={editingEmailAccount.imap_username || ""} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, imap_username: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="IMAP username" placeholder="IMAP username" />
                            <Input value={editingEmailAccount.smtp_host || ""} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, smtp_host: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="SMTP host" placeholder="SMTP host" />
                            <Input value={editingEmailAccount.smtp_username || ""} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, smtp_username: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="SMTP username" placeholder="SMTP username" />
                            <Input value={editingEmailAccount.secret || ""} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, secret: event.target.value })} type="password" className="h-9 rounded-xl bg-background md:col-span-2" aria-label="App password" placeholder="New app password, optional" />
                            {emailMessage && <p className="text-sm text-destructive md:col-span-2">{emailMessage}</p>}
                            <div className="flex gap-2 pb-2 md:col-span-2">
                              <Button type="button" className="h-9 rounded-xl" disabled={busyMemberId === account.id} onClick={() => saveEmailAccountEdit(account)}>{busyMemberId === account.id ? "Testing..." : "Test & save"}</Button>
                              <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" onClick={() => { setEditingEmailAccountId(""); setEditingEmailAccount(null); }}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="truncate text-sm font-medium">{account.name || "Untitled integration"}</div>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">{account.email} · {account.sync_enabled ? "Sync enabled" : "Sync disabled"}{account.last_synced_at ? ` · Last sync ${lastSyncLabel(account.last_synced_at)}` : ""}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!editingName && <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={busyMemberId === account.id} onClick={() => { setEmailMessage(""); setEditingEmailAccountId(account.id); setEditingEmailAccount(account); }}>Edit</Button>}
                        <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={busyMemberId === account.id} onClick={() => setEmailSync(account, !account.sync_enabled)}>{account.sync_enabled ? "Disable" : "Enable"}</Button>
                        <ConfirmAction trigger={<Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={busyMemberId === account.id}>Remove</Button>} title="Remove email integration?" description={`${account.email} will stop syncing.`} actionLabel="Remove" onConfirm={() => deleteEmailAccount(account)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-6">
        <div>
          <h2 className="text-sm font-semibold">Invite</h2>
          <p className="mt-1 text-sm text-muted-foreground">Send a magic-link invitation to a teammate.</p>
        </div>
        <div className="space-y-4">
          <form className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_140px_auto]" onSubmit={invite}>
            <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} type="email" required placeholder="teammate@example.com" className="h-9 rounded-xl bg-background" disabled={!canManage || inviting} />
            <Select value={inviteRole} disabled={!canManage || inviting} onValueChange={setInviteRole}>
              <SelectTrigger aria-label="Invite role" className="h-9 rounded-xl bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl">
                {ORG_ROLES.filter((role) => role !== "owner").map((role) => <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" className="h-9 rounded-xl" disabled={!canManage || inviting}>{inviting ? "Sending..." : "Invite"}</Button>
            {message && <p className="text-sm text-muted-foreground sm:col-span-3">{message}</p>}
          </form>
          <div className="overflow-hidden rounded-xl border">
            {invitations.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No invitations yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {invitations.map((invitation) => {
                  const accepted = Boolean(invitation.accepted_at);
                  const expired = !accepted && isPast(invitation.expires_at);
                  return (
                    <div key={invitation.id ?? invitation.email} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{invitation.email}</div>
                        <div className="text-xs text-muted-foreground">{roleLabel(invitation.role)} · {accepted ? "Accepted" : expired ? "Expired" : "Pending"}</div>
                      </div>
                      <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={!canManage || accepted || busyMemberId === invitation.id} onClick={() => resendInvitation(invitation)}>
                        {busyMemberId === invitation.id ? "Sending..." : "Resend"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <Sheet open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Add email integration</SheetTitle>
            <SheetDescription>Test the IMAP connection before saving. The account cannot be saved until the test succeeds.</SheetDescription>
          </SheetHeader>
          <form className="mt-5 grid gap-3" onSubmit={saveEmailAccount}>
            <LabeledInput label="Name" value={emailForm.name} onChange={(value) => { setEmailForm({ ...emailForm, name: value }); setEmailTestState("idle"); }} placeholder="Work" />
            <LabeledInput label="Email address" value={emailForm.email} onChange={(value) => { setEmailForm({ ...emailForm, email: value }); setEmailTestState("idle"); }} type="email" required placeholder="you@example.com" />
            <div className="grid gap-3 sm:grid-cols-2">
              <LabeledInput label="IMAP host" value={emailForm.imap_host} onChange={(value) => { setEmailForm({ ...emailForm, imap_host: value }); setEmailTestState("idle"); }} required placeholder="imap.example.com" />
              <LabeledInput label="IMAP port" value={emailForm.imap_port} onChange={(value) => { setEmailForm({ ...emailForm, imap_port: value }); setEmailTestState("idle"); }} inputMode="numeric" />
            </div>
            <LabeledInput label="IMAP username" value={emailForm.imap_username} onChange={(value) => { setEmailForm({ ...emailForm, imap_username: value }); setEmailTestState("idle"); }} placeholder="you@example.com" />
            <div className="grid gap-3 sm:grid-cols-2">
              <LabeledInput label="SMTP host" value={emailForm.smtp_host} onChange={(value) => setEmailForm({ ...emailForm, smtp_host: value })} placeholder="smtp.example.com" />
              <LabeledInput label="SMTP port" value={emailForm.smtp_port} onChange={(value) => setEmailForm({ ...emailForm, smtp_port: value })} inputMode="numeric" />
            </div>
            <LabeledInput label="SMTP username" value={emailForm.smtp_username} onChange={(value) => setEmailForm({ ...emailForm, smtp_username: value })} placeholder="you@example.com" />
            <LabeledInput label="App password" value={emailForm.secret} onChange={(value) => { setEmailForm({ ...emailForm, secret: value }); setEmailTestState("idle"); }} type="password" required />
            {emailTestMessage && <p className={cn("text-sm", emailTestState === "success" ? "text-emerald-600" : "text-destructive")}>{emailTestMessage}</p>}
            {emailMessage && <p className="text-sm text-destructive">{emailMessage}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={emailTestState === "testing"} onClick={testEmailAccount}>{emailTestState === "testing" ? "Testing..." : "Test connection"}</Button>
              <Button type="submit" className="h-9 rounded-xl" disabled={savingEmail || emailTestState !== "success"}>{savingEmail ? "Saving..." : "Save"}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {canManage && (
        <section className="grid gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-6">
          <div>
            <h2 className="text-sm font-semibold">Audit log</h2>
            <p className="mt-1 text-sm text-muted-foreground">Recent security-sensitive team events.</p>
          </div>
          <div className="overflow-hidden rounded-xl border">
            {auditLogs.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No audit events yet.</div> : (
              <div className="divide-y divide-border">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm font-medium">{auditActionLabel(log.action)}</div>
                      <div className="text-xs text-muted-foreground">{relativeDate(log.created_at)}</div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{log.actor_email || "System"}{log.details?.email ? ` · ${String(log.details.email)}` : ""}{log.details?.role ? ` · ${String(log.details.role)}` : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function auditActionLabel(action: string) {
  return action.split(".").map(roleLabel).join(" ");
}

function lastSyncLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (sameDay) {
    if (minutes < 60) return `today ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    return `today ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  return relativeDate(value);
}

const ORG_ROLES = ["owner", "admin", "member", "viewer"];

function isPast(value: string) {
  return new Date(value).getTime() < new Date().getTime();
}

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function OrganizationSelect({ organizations, value, onChange }: { organizations: OrganizationMembership[]; value: string; onChange: (value: string) => void }) {
  if (organizations.length <= 1) {
    const org = organizations[0];
    return org ? <div className="flex h-9 items-center rounded-xl border border-border bg-background px-3 text-sm font-medium">{org.name}</div> : null;
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Select team" className="h-9 w-[180px] rounded-xl bg-background">
        <SelectValue placeholder="Select team" />
      </SelectTrigger>
      <SelectContent align="end" className="rounded-xl">
        {organizations.map((org) => (
          <SelectItem key={org.organization_id} value={org.organization_id} className="rounded-lg py-2 pl-3 pr-8">
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AccountMenu({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 rounded-xl bg-background">
          <UserRound className="size-4" /> Account <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl">
        <DropdownMenuLabel>CRMe</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => { void onLogout(); }}>
          <LogOut className="size-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PlainToast({ message, onClose }: { message: string; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <ToastProvider duration={4000}>
      <Toast
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) onClose();
        }}
      >
        <span className="min-w-0 flex-1">{message}</span>
        <ToastClose asChild>
          <Button size="sm" variant="ghost" className="h-8 rounded-xl">Close</Button>
        </ToastClose>
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}

function UndoToast({ undo, onDone, onClose }: { undo: SuggestionUndo; onDone: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);

  async function runUndo() {
    setBusy(true);
    try {
      if (undo.createdEntityType === "company" && undo.createdEntityId) {
        await api.deleteCompany(undo.createdEntityId);
      }
      if (undo.createdEntityType === "person" && undo.createdEntityId) {
        await api.deletePerson(undo.createdEntityId);
      }
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
      <Toast
        open={open}
        onOpenChange={(nextOpen) => {
          if (busy && !nextOpen) return;
          setOpen(nextOpen);
          if (!nextOpen) onClose();
        }}
      >
        <span className="min-w-0 flex-1">{undo.label}</span>
        <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" disabled={busy} onClick={runUndo}>Undo</Button>
        <ToastClose asChild>
          <Button size="sm" variant="ghost" className="h-8 rounded-xl" disabled={busy}>Close</Button>
        </ToastClose>
        <span className="absolute inset-x-0 bottom-0 h-1 origin-left animate-[toast-progress_10s_linear_forwards] bg-primary/55" />
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}

function PagedTable({ children, page, hasNext, loading, onPageChange }: { children: ReactNode; page: number; hasNext: boolean; loading: boolean; onPageChange: (page: number) => void }) {
  return (
    <div>
      {children}
      <div className="flex justify-center border-t bg-[oklch(0.985_0.004_255)] px-5 py-4">
        <div className="grid grid-cols-[7rem_auto_7rem] items-center gap-3">
          <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={loading || page === 0} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          <span className="min-w-20 text-center text-sm text-muted-foreground">Page {page + 1}</span>
          <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={loading || !hasNext} onClick={() => onPageChange(page + 1)}>
            {loading ? "Loading..." : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type DashboardDealRelations = Record<string, { people: Person[]; companies: Company[] }>;

function DashboardPanel({ tasks, suggestions, people, companies, deals, onSelectTask, onSelectPerson, onSelectCompany, onSelectDeal, onOpenTasks, onOpenSuggestions }: { tasks: Todo[]; suggestions: Suggestion[]; people: Person[]; companies: Company[]; deals: Deal[]; onSelectTask: (task: Todo) => void; onSelectPerson: (person: Person) => void; onSelectCompany: (company: Company) => void; onSelectDeal: (deal: Deal) => void; onOpenTasks: () => void; onOpenSuggestions: () => void }) {
  const [taskPage, setTaskPage] = useState(0);
  const [dealRelations, setDealRelations] = useState<DashboardDealRelations>({});
  const openTasks = tasks.filter((task) => task.status === "open");
  const openSuggestions = suggestions.filter((suggestion) => suggestion.status === "open");
  const urgentTasks = openTasks.filter((task) => task.priority === "urgent" || task.priority === "high");
  const sortedTasks = [...openTasks].sort(sortTasksForDashboard);
  const nowTasks = sortedTasks.filter(isNowTask);
  const nowTaskIds = new Set(nowTasks.map((task) => task.id));
  const laterTasks = sortedTasks.filter((task) => !nowTaskIds.has(task.id));
  const taskPageSize = 7;
  const taskPageCount = Math.max(1, Math.ceil(laterTasks.length / taskPageSize));
  const currentTaskPage = Math.min(taskPage, taskPageCount - 1);
  const visibleTasks = laterTasks.slice(currentTaskPage * taskPageSize, currentTaskPage * taskPageSize + taskPageSize);
  const dashboardTasks = [...nowTasks, ...visibleTasks];
  const dashboardDealIdsKey = [...new Set(dashboardTasks.filter((task) => task.entity_type === "deal" && task.entity_id).map((task) => task.entity_id))].join(",");
  const suggestionGroups = groupSuggestions(openSuggestions);

  useEffect(() => {
    let cancelled = false;
    const dashboardDealIds = dashboardDealIdsKey ? dashboardDealIdsKey.split(",") : [];
    const missingDealIds = dashboardDealIds.filter((id) => !dealRelations[id]);
    if (!missingDealIds.length) return;

    async function loadDealRelations() {
      const entries = await Promise.all(missingDealIds.map(async (dealId) => {
        try {
          const [linkedPeople, linkedCompanies] = await Promise.all([api.dealPeople(dealId), api.dealCompanies(dealId)]);
          return [dealId, { people: linkedPeople ?? [], companies: linkedCompanies ?? [] }] as const;
        } catch {
          return [dealId, { people: [], companies: [] }] as const;
        }
      }));
      if (!cancelled) {
        setDealRelations((current) => ({ ...current, ...Object.fromEntries(entries) }));
      }
    }

    void loadDealRelations();
    return () => { cancelled = true; };
  }, [dashboardDealIdsKey, dealRelations]);

  return (
    <div className="bg-[oklch(0.985_0.003_255)]">
      <div className="space-y-4 bg-[oklch(0.985_0.003_255)] p-4">
        <section className="min-w-0 overflow-hidden rounded-xl border bg-background">
          <div className="flex flex-col gap-3 border-b bg-[oklch(0.965_0.008_255)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-[-0.02em]">Act next</h2>
              <p className="mt-1 text-xs text-muted-foreground">Urgent work first, then the rest of the queue.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-background px-2.5 py-1 ring-1 ring-border">{urgentTasks.length} urgent or high</span>
              <span className="rounded-full bg-background px-2.5 py-1 ring-1 ring-border">{openTasks.length} open</span>
              <Button variant="outline" className="ml-0 h-8 rounded-xl bg-background px-3 text-xs sm:ml-1" onClick={onOpenTasks}>All tasks</Button>
            </div>
          </div>

          {nowTasks.length || visibleTasks.length ? (
            <>
              {nowTasks.length ? (
                <div className="border-b">
                  <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3.5">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[oklch(0.38_0.08_45)]">Now</h3>
                      <span className="text-xs text-[oklch(0.46_0.055_58)]">overdue, due today, or high priority</span>
                    </div>
                    <span className="text-xs tabular-nums text-[oklch(0.46_0.055_58)]">{nowTasks.length}</span>
                  </div>
                  <div className="divide-y divide-[oklch(0.88_0.025_58)] border-t border-[oklch(0.88_0.025_58)]">
                    {nowTasks.map((task) => (
                      <DashboardTaskRow
                        key={task.id}
                        task={task}
                        people={people}
                        companies={companies}
                        deals={deals}
                        emphasized
                        onSelectTask={onSelectTask}
                        onSelectPerson={onSelectPerson}
                        onSelectCompany={onSelectCompany}
                        onSelectDeal={onSelectDeal}
                        dealRelations={task.entity_type === "deal" ? dealRelations[task.entity_id] : undefined}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {visibleTasks.length ? (
                <div>
                  <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3.5">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Next</h3>
                      <span className="text-xs text-muted-foreground">remaining open tasks</span>
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">{laterTasks.length}</span>
                  </div>
                  <div className="divide-y border-t">
                    {visibleTasks.map((task) => (
                      <DashboardTaskRow
                        key={task.id}
                        task={task}
                        people={people}
                        companies={companies}
                        deals={deals}
                        onSelectTask={onSelectTask}
                        onSelectPerson={onSelectPerson}
                        onSelectCompany={onSelectCompany}
                        onSelectDeal={onSelectDeal}
                        dealRelations={task.entity_type === "deal" ? dealRelations[task.entity_id] : undefined}
                      />
                    ))}
                  </div>
                  <DashboardPager
                    page={currentTaskPage}
                    pageCount={taskPageCount}
                    total={laterTasks.length}
                    itemLabel="later tasks"
                    onPrevious={() => setTaskPage((page) => Math.max(0, page - 1))}
                    onNext={() => setTaskPage((page) => Math.min(taskPageCount - 1, page + 1))}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState title="Nothing urgent is waiting" body="Open tasks will appear here with due date, priority, and the linked record." />
          )}
        </section>

        <aside className="min-w-0 overflow-hidden rounded-xl border bg-background">
          <div className="flex items-center justify-between gap-3 border-b bg-[oklch(0.965_0.008_255)] px-5 py-4">
            <div>
              <h2 className="text-base font-semibold tracking-[-0.02em]">Recommendations</h2>
              <p className="mt-1 text-xs text-muted-foreground">Suggested updates and follow-ups.</p>
            </div>
            <Button variant="outline" className="h-8 rounded-xl bg-background px-3 text-xs" onClick={onOpenSuggestions}>All suggestions</Button>
          </div>

          {suggestionGroups.length ? (
            <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">
              {suggestionGroups.map((group) => (
                <button
                  key={group.kind}
                  type="button"
                  className="block min-w-0 px-5 py-4 text-left transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
                  onClick={onOpenSuggestions}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm font-medium tracking-[-0.01em]">{group.label}</div>
                    <div className="text-lg font-semibold tabular-nums tracking-[-0.035em]">{group.count}</div>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{group.description}</p>
                  <div className="mt-3 text-xs text-muted-foreground">Latest {relativeDate(group.latestAt)}</div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No recommendations waiting" body="Future enrichment prompts, like missing email or stale follow-up, will appear here." />
          )}
        </aside>
      </div>
    </div>
  );
}

function groupSuggestions(suggestions: Suggestion[]) {
  const groups = new Map<Suggestion["kind"], { kind: Suggestion["kind"]; count: number; latestAt?: string }>();
  for (const suggestion of suggestions) {
    const current = groups.get(suggestion.kind);
    const date = suggestion.last_touch_at ?? suggestion.created_at;
    if (!current) {
      groups.set(suggestion.kind, { kind: suggestion.kind, count: 1, latestAt: date });
      continue;
    }
    current.count += 1;
    if (compareDates(date, current.latestAt, "desc") < 0) current.latestAt = date;
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || compareDates(a.latestAt, b.latestAt, "desc"))
    .map((group) => ({ ...group, ...suggestionGroupCopy(group.kind, group.count) }));
}

function suggestionGroupCopy(kind: Suggestion["kind"], count: number) {
  if (kind === "new_contact") return { label: count === 1 ? "New person" : "New people", description: "People found from activity that may belong in CRMe." };
  if (kind === "new_company") return { label: count === 1 ? "New company" : "New companies", description: "Companies found from email domains or activity." };
  if (kind === "possible_merge") return { label: count === 1 ? "Possible merge" : "Possible merges", description: "Records that may describe the same person or company." };
  if (kind === "follow_up") return { label: count === 1 ? "Follow-up" : "Follow-ups", description: "Relationships that may need a next touch." };
  if (kind === "deal_stage_nudge") return { label: count === 1 ? "Deal nudge" : "Deal nudges", description: "Deals that may need a stage or status review." };
  return { label: String(kind).replaceAll("_", " "), description: "Suggested CRM updates waiting for review." };
}

function DashboardPager({ page, pageCount, total, itemLabel, onPrevious, onNext }: { page: number; pageCount: number; total: number; itemLabel: string; onPrevious: () => void; onNext: () => void }) {
  return (
    <div className="flex flex-col gap-2 border-t px-5 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>{total} {itemLabel} · page {page + 1} of {pageCount}</span>
      <div className="flex gap-2">
        <Button variant="outline" className="h-8 rounded-xl bg-background px-3 text-xs" disabled={page === 0} onClick={onPrevious}>Previous</Button>
        <Button variant="outline" className="h-8 rounded-xl bg-background px-3 text-xs" disabled={page >= pageCount - 1} onClick={onNext}>Next</Button>
      </div>
    </div>
  );
}

function DashboardTaskRow({ task, people, companies, deals, dealRelations, emphasized = false, onSelectTask, onSelectPerson, onSelectCompany, onSelectDeal }: { task: Todo; people: Person[]; companies: Company[]; deals: Deal[]; dealRelations?: { people: Person[]; companies: Company[] }; emphasized?: boolean; onSelectTask: (task: Todo) => void; onSelectPerson: (person: Person) => void; onSelectCompany: (company: Company) => void; onSelectDeal: (deal: Deal) => void }) {
  const title = task.title || firstUsefulLine(task.body) || "Untitled task";
  const entityLabel = linkedEntityLabel(task, people, companies, deals);
  const linkedDeal = task.entity_type === "deal" ? deals.find((deal) => deal.id === task.entity_id) : undefined;
  const overdue = isOverdue(task.due_at);
  const dueToday = isDueToday(task.due_at);

  return (
    <div className={cn("grid gap-3 px-5 transition-colors hover:bg-muted/40 sm:grid-cols-[104px_minmax(0,1fr)_220px_104px] sm:items-center", emphasized ? "py-3.5" : "py-2.5")}>
      <button type="button" className="min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ring" onClick={() => onSelectTask(task)}>
        <span className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
          task.priority === "urgent" && "bg-[oklch(0.91_0.055_28)] text-[oklch(0.42_0.13_28)]",
          task.priority === "high" && "bg-[oklch(0.93_0.04_58)] text-[oklch(0.38_0.08_45)]",
          task.priority === "normal" && "text-muted-foreground",
          task.priority === "low" && "text-muted-foreground",
        )}>{task.priority || "normal"}</span>
      </button>

      <button type="button" className="min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ring" onClick={() => onSelectTask(task)}>
        <div className={cn("truncate font-medium tracking-[-0.01em]", emphasized ? "text-sm" : "text-[13px]")}>{title}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{task.body || "No details"}</div>
      </button>

      <div className="min-w-0 text-[13px] text-muted-foreground">
        {linkedDeal && dealRelations && (dealRelations.people.length || dealRelations.companies.length) ? (
          <div className="min-w-0 space-y-1">
            <DashboardEntityButton label={linkedDeal.name || "Unnamed deal"} icon={<LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />} onClick={() => onSelectDeal(linkedDeal)} />
            <div className="flex min-w-0 flex-wrap gap-1">
              {dealRelations.people.map((person) => (
                <DashboardRelationChip key={`person-${person.id}`} label={fullName(person)} onClick={() => onSelectPerson(person)} />
              ))}
              {dealRelations.companies.map((company) => (
                <DashboardRelationChip key={`company-${company.id}`} label={company.name || company.domain || "Unnamed company"} onClick={() => onSelectCompany(company)} />
              ))}
            </div>
          </div>
        ) : (
          <DashboardEntityButton label={entityLabel} icon={<LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />} onClick={() => openTaskEntity(task, people, companies, deals, onSelectPerson, onSelectCompany, onSelectDeal)} />
        )}
      </div>

      <button type="button" className="text-left focus:outline-none focus:ring-2 focus:ring-ring" onClick={() => onSelectTask(task)}>
        <div className={cn(
          "text-[13px] font-medium",
          overdue && "text-[oklch(0.46_0.15_28)]",
          dueToday && "text-[oklch(0.42_0.11_55)]",
        )}>{overdue ? "Overdue" : dueToday ? "Today" : relativeDate(task.due_at)}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{shortDate(task.due_at)}</div>
      </button>
    </div>
  );
}

function DashboardEntityButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="flex max-w-full items-center gap-1.5 text-left hover:underline focus:outline-none focus:ring-2 focus:ring-ring" onClick={onClick}>
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function DashboardRelationChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="max-w-full truncate rounded-lg bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" onClick={onClick}>
      {label}
    </button>
  );
}

function sortTasksForDashboard(a: Todo, b: Todo) {
  const dashboardRank = dashboardTaskRank(a) - dashboardTaskRank(b);
  if (dashboardRank !== 0) return dashboardRank;
  const priority = priorityRank(a.priority) - priorityRank(b.priority);
  if (priority !== 0) return priority;
  const dueA = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
  const dueB = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
  if (dueA !== dueB) return dueA - dueB;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function dashboardTaskRank(task: Todo) {
  if (isOverdue(task.due_at)) return 0;
  if (isDueToday(task.due_at)) return 1;
  if (task.priority === "urgent" || task.priority === "high") return 2;
  return 3;
}

function isNowTask(task: Todo) {
  return dashboardTaskRank(task) < 3;
}

function priorityRank(priority: Todo["priority"]) {
  if (priority === "urgent") return 0;
  if (priority === "high") return 1;
  if (priority === "normal") return 2;
  return 3;
}

function isOverdue(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

function isDueToday(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function openTaskEntity(task: Todo, people: Person[], companies: Company[], deals: Deal[], onSelectPerson: (person: Person) => void, onSelectCompany: (company: Company) => void, onSelectDeal: (deal: Deal) => void) {
  if (task.entity_type === "person") {
    const person = people.find((item) => item.id === task.entity_id);
    if (person) onSelectPerson(person);
  }
  if (task.entity_type === "company") {
    const company = companies.find((item) => item.id === task.entity_id);
    if (company) onSelectCompany(company);
  }
  if (task.entity_type === "deal") {
    const deal = deals.find((item) => item.id === task.entity_id);
    if (deal) onSelectDeal(deal);
  }
}

function OrganizationGate({ userEmail, organizations, selectedOrganizationId, onSelect, onCreated }: { userEmail?: string; organizations: OrganizationMembership[]; selectedOrganizationId: string; onSelect: (id: string) => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("Default Team");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const org = await api.createOrganization(name);
      setSelectedOrganizationId(org.id);
      onCreated(org.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create team");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-[0_12px_36px_oklch(0.45_0.01_255_/_0.12)]">
        <p className="text-xs font-medium tracking-[-0.01em] text-muted-foreground">CRMe</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Choose a team</h1>
        <p className="mt-2 text-sm text-muted-foreground">{userEmail ? `Signed in as ${userEmail}.` : "Select the team to work in."}</p>
        {organizations.length > 0 ? (
          <div className="mt-6 space-y-2">
            {organizations.map((org) => (
              <Button key={org.organization_id} type="button" variant={selectedOrganizationId === org.organization_id ? "default" : "outline"} className="h-10 w-full justify-between rounded-xl" onClick={() => onSelect(org.organization_id)}>
                <span>{org.name}</span>
                <span className="text-xs capitalize opacity-70">{org.role}</span>
              </Button>
            ))}
          </div>
        ) : (
          <form className="mt-6" onSubmit={createOrganization}>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Team name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} required className="h-10 rounded-xl bg-background" />
            <Button className="mt-3 h-10 w-full rounded-xl" type="submit" disabled={saving}>{saving ? "Creating..." : "Create team"}</Button>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}

function LoginScreen({ onRetry }: { onRetry: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function retryOnFocus() {
      onRetry();
    }

    window.addEventListener("focus", retryOnFocus);
    return () => window.removeEventListener("focus", retryOnFocus);
  }, [onRetry]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await api.requestMagicLink(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request magic link");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-[0_12px_36px_oklch(0.45_0.01_255_/_0.12)]">
        <form onSubmit={submit}>
          <p className="text-xs font-medium tracking-[-0.01em] text-muted-foreground">CRMe</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Request a magic link. After opening it, return here and the app will retry automatically.
          </p>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required aria-label="Email address" placeholder="you@example.com" className="mt-6 h-10 rounded-xl bg-background" />
          <Button className="mt-3 h-10 w-full rounded-xl" type="submit">Send magic link</Button>
          {sent && <p className="mt-3 text-sm text-[oklch(0.48_0.12_155)]">Magic link requested. Open the logged URL, then come back to this tab.</p>}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </form>
      </div>
    </main>
  );
}


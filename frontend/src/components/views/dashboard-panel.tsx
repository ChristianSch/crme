"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LinkIcon } from "lucide-react";

import { EmptyState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { api, Company, Deal, fullName, Person, Suggestion, Todo } from "@/lib/api";
import { compareDates, firstUsefulLine, linkedEntityLabel, relativeDate, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type DashboardDealRelations = Record<string, { people: Person[]; companies: Company[] }>;

export function DashboardPanel({ tasks, suggestions, people, companies, deals, onSelectTask, onSelectPerson, onSelectCompany, onSelectDeal, onOpenTasks, onOpenSuggestions }: { tasks: Todo[]; suggestions: Suggestion[]; people: Person[]; companies: Company[]; deals: Deal[]; onSelectTask: (task: Todo) => void; onSelectPerson?: (person: Person) => void; onSelectCompany?: (company: Company) => void; onSelectDeal?: (deal: Deal) => void; onOpenTasks: () => void; onOpenSuggestions: () => void }) {
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
      if (!cancelled) setDealRelations((current) => ({ ...current, ...Object.fromEntries(entries) }));
    }

    void loadDealRelations();
    return () => { cancelled = true; };
  }, [dashboardDealIdsKey, dealRelations]);

  return (
    <div className="bg-[oklch(0.985_0.003_255)]">
      <div className="space-y-4 bg-[oklch(0.985_0.003_255)] p-4">
        <section className="min-w-0 overflow-hidden rounded-xl border bg-background">
          <div className="flex flex-col gap-3 border-b bg-[oklch(0.965_0.008_255)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-base font-semibold tracking-[-0.02em]">Act next</h2><p className="mt-1 text-xs text-muted-foreground">Urgent work first, then the rest of the queue.</p></div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-background px-2.5 py-1 ring-1 ring-border">{urgentTasks.length} urgent or high</span>
              <span className="rounded-full bg-background px-2.5 py-1 ring-1 ring-border">{openTasks.length} open</span>
              <Button variant="outline" className="ml-0 h-8 rounded-xl bg-background px-3 text-xs sm:ml-1" onClick={onOpenTasks}>All tasks</Button>
            </div>
          </div>
          {nowTasks.length || visibleTasks.length ? (
            <>
              {nowTasks.length ? <TaskGroup title="Now" subtitle="overdue, due today, or high priority" count={nowTasks.length} tasks={nowTasks} people={people} companies={companies} deals={deals} dealRelations={dealRelations} emphasized onSelectTask={onSelectTask} onSelectPerson={onSelectPerson} onSelectCompany={onSelectCompany} onSelectDeal={onSelectDeal} /> : null}
              {visibleTasks.length ? <div><TaskGroup title="Next" subtitle="remaining open tasks" count={laterTasks.length} tasks={visibleTasks} people={people} companies={companies} deals={deals} dealRelations={dealRelations} onSelectTask={onSelectTask} onSelectPerson={onSelectPerson} onSelectCompany={onSelectCompany} onSelectDeal={onSelectDeal} /><DashboardPager page={currentTaskPage} pageCount={taskPageCount} total={laterTasks.length} itemLabel="later tasks" onPrevious={() => setTaskPage((page) => Math.max(0, page - 1))} onNext={() => setTaskPage((page) => Math.min(taskPageCount - 1, page + 1))} /></div> : null}
            </>
          ) : <EmptyState title="Nothing urgent is waiting" body="Open tasks will appear here with due date, priority, and the linked record." />}
        </section>
        <aside className="min-w-0 overflow-hidden rounded-xl border bg-background">
          <div className="flex items-center justify-between gap-3 border-b bg-[oklch(0.965_0.008_255)] px-5 py-4">
            <div><h2 className="text-base font-semibold tracking-[-0.02em]">Recommendations</h2><p className="mt-1 text-xs text-muted-foreground">Suggested updates and follow-ups.</p></div>
            <Button variant="outline" className="h-8 rounded-xl bg-background px-3 text-xs" onClick={onOpenSuggestions}>All suggestions</Button>
          </div>
          {suggestionGroups.length ? <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">{suggestionGroups.map((group) => <button key={group.kind} type="button" className="block min-w-0 px-5 py-4 text-left transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring" onClick={onOpenSuggestions}><div className="flex items-baseline justify-between gap-3"><div className="text-sm font-medium tracking-[-0.01em]">{group.label}</div><div className="text-lg font-semibold tabular-nums tracking-[-0.035em]">{group.count}</div></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{group.description}</p><div className="mt-3 text-xs text-muted-foreground">Latest {relativeDate(group.latestAt)}</div></button>)}</div> : <EmptyState title="No recommendations waiting" body="Future enrichment prompts, like missing email or stale follow-up, will appear here." />}
        </aside>
      </div>
    </div>
  );
}

function TaskGroup(props: { title: string; subtitle: string; count: number; tasks: Todo[]; people: Person[]; companies: Company[]; deals: Deal[]; dealRelations: DashboardDealRelations; emphasized?: boolean; onSelectTask: (task: Todo) => void; onSelectPerson?: (person: Person) => void; onSelectCompany?: (company: Company) => void; onSelectDeal?: (deal: Deal) => void }) {
  return <div className="border-b"><div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3.5"><div className="flex items-baseline gap-2"><h3 className="text-xs font-semibold text-muted-foreground">{props.title}</h3><span className="text-xs text-muted-foreground">{props.subtitle}</span></div><span className="text-xs tabular-nums text-muted-foreground">{props.count}</span></div><div className="divide-y border-t">{props.tasks.map((task) => <DashboardTaskRow key={task.id} task={task} people={props.people} companies={props.companies} deals={props.deals} emphasized={props.emphasized} onSelectTask={props.onSelectTask} onSelectPerson={props.onSelectPerson} onSelectCompany={props.onSelectCompany} onSelectDeal={props.onSelectDeal} dealRelations={task.entity_type === "deal" ? props.dealRelations[task.entity_id] : undefined} />)}</div></div>;
}

function groupSuggestions(suggestions: Suggestion[]) {
  const groups = new Map<Suggestion["kind"], { kind: Suggestion["kind"]; count: number; latestAt?: string }>();
  for (const suggestion of suggestions) {
    const current = groups.get(suggestion.kind);
    const date = suggestion.last_touch_at ?? suggestion.created_at;
    if (!current) groups.set(suggestion.kind, { kind: suggestion.kind, count: 1, latestAt: date });
    else { current.count += 1; if (compareDates(date, current.latestAt, "desc") < 0) current.latestAt = date; }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || compareDates(a.latestAt, b.latestAt, "desc")).map((group) => ({ ...group, ...suggestionGroupCopy(group.kind, group.count) }));
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
  return <div className="flex flex-col gap-2 border-t px-5 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{total} {itemLabel} · page {page + 1} of {pageCount}</span><div className="flex gap-2"><Button variant="outline" className="h-8 rounded-xl bg-background px-3 text-xs" disabled={page === 0} onClick={onPrevious}>Previous</Button><Button variant="outline" className="h-8 rounded-xl bg-background px-3 text-xs" disabled={page >= pageCount - 1} onClick={onNext}>Next</Button></div></div>;
}

function DashboardTaskRow({ task, people, companies, deals, dealRelations, emphasized = false, onSelectTask, onSelectPerson, onSelectCompany, onSelectDeal }: { task: Todo; people: Person[]; companies: Company[]; deals: Deal[]; dealRelations?: { people: Person[]; companies: Company[] }; emphasized?: boolean; onSelectTask: (task: Todo) => void; onSelectPerson?: (person: Person) => void; onSelectCompany?: (company: Company) => void; onSelectDeal?: (deal: Deal) => void }) {
  const title = task.title || firstUsefulLine(task.body) || "Untitled task";
  const entityLabel = linkedEntityLabel(task, people, companies, deals);
  const linkedDeal = task.entity_type === "deal" ? deals.find((deal) => deal.id === task.entity_id) : undefined;
  const overdue = isOverdue(task.due_at);
  const dueToday = isDueToday(task.due_at);
  return <div className={cn("grid gap-3 px-5 transition-colors hover:bg-muted/40 sm:grid-cols-[104px_minmax(0,1fr)_220px_104px] sm:items-center", emphasized ? "py-3.5" : "py-2.5")}><button type="button" className="min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ring" onClick={() => onSelectTask(task)}><span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", task.priority === "urgent" && "bg-[oklch(0.91_0.055_28)] text-[oklch(0.42_0.13_28)]", task.priority === "high" && "bg-[oklch(0.93_0.04_58)] text-[oklch(0.38_0.08_45)]", (task.priority === "normal" || task.priority === "low") && "text-muted-foreground")}>{task.priority || "normal"}</span></button><button type="button" className="min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ring" onClick={() => onSelectTask(task)}><div className={cn("truncate font-medium tracking-[-0.01em]", emphasized ? "text-sm" : "text-[13px]")}>{title}</div><div className="mt-0.5 truncate text-xs text-muted-foreground">{task.body || "No details"}</div></button><div className="min-w-0 text-[13px] text-muted-foreground">{linkedDeal && dealRelations && (dealRelations.people.length || dealRelations.companies.length) ? <div className="min-w-0 space-y-1"><DashboardEntityButton label={linkedDeal.name || "Unnamed deal"} icon={<LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />} onClick={onSelectDeal ? () => onSelectDeal(linkedDeal) : undefined} /><div className="flex min-w-0 flex-wrap gap-1">{dealRelations.people.map((person) => <DashboardRelationChip key={`person-${person.id}`} label={fullName(person)} onClick={onSelectPerson ? () => onSelectPerson(person) : undefined} />)}{dealRelations.companies.map((company) => <DashboardRelationChip key={`company-${company.id}`} label={company.name || company.domain || "Unnamed company"} onClick={onSelectCompany ? () => onSelectCompany(company) : undefined} />)}</div></div> : <DashboardEntityButton label={entityLabel} icon={<LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />} onClick={taskEntityHandler(task, people, companies, deals, onSelectPerson, onSelectCompany, onSelectDeal)} />}</div><button type="button" className="text-left focus:outline-none focus:ring-2 focus:ring-ring" onClick={() => onSelectTask(task)}><div className={cn("text-[13px] font-medium", overdue && "text-[oklch(0.46_0.15_28)]", dueToday && "text-[oklch(0.42_0.11_55)]")}>{overdue ? "Overdue" : dueToday ? "Today" : relativeDate(task.due_at)}</div><div className="mt-0.5 text-xs text-muted-foreground">{shortDate(task.due_at)}</div></button></div>;
}

function DashboardEntityButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick?: () => void }) { return onClick ? <button type="button" className="flex max-w-full items-center gap-1.5 text-left hover:underline focus:outline-none focus:ring-2 focus:ring-ring" onClick={onClick}>{icon}<span className="truncate">{label}</span></button> : <span className="flex max-w-full items-center gap-1.5">{icon}<span className="truncate">{label}</span></span>; }
function DashboardRelationChip({ label, onClick }: { label: string; onClick?: () => void }) { return onClick ? <button type="button" className="max-w-full truncate rounded-lg bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" onClick={onClick}>{label}</button> : <span className="max-w-full truncate rounded-lg bg-muted px-2 py-0.5 text-xs text-muted-foreground">{label}</span>; }
function sortTasksForDashboard(a: Todo, b: Todo) { const rank = dashboardTaskRank(a) - dashboardTaskRank(b); if (rank !== 0) return rank; const priority = priorityRank(a.priority) - priorityRank(b.priority); if (priority !== 0) return priority; const dueA = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER; const dueB = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER; if (dueA !== dueB) return dueA - dueB; return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); }
function dashboardTaskRank(task: Todo) { if (isOverdue(task.due_at)) return 0; if (isDueToday(task.due_at)) return 1; if (task.priority === "urgent" || task.priority === "high") return 2; return 3; }
function isNowTask(task: Todo) { return dashboardTaskRank(task) < 3; }
function priorityRank(priority: Todo["priority"]) { if (priority === "urgent") return 0; if (priority === "high") return 1; if (priority === "normal") return 2; return 3; }
function isOverdue(value?: string) { if (!value) return false; const date = new Date(value); const today = new Date(); today.setHours(0, 0, 0, 0); date.setHours(0, 0, 0, 0); return date.getTime() < today.getTime(); }
function isDueToday(value?: string) { if (!value) return false; const date = new Date(value); const today = new Date(); return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate(); }
function taskEntityHandler(task: Todo, people: Person[], companies: Company[], deals: Deal[], onSelectPerson?: (person: Person) => void, onSelectCompany?: (company: Company) => void, onSelectDeal?: (deal: Deal) => void) { if (task.entity_type === "person") { const person = people.find((item) => item.id === task.entity_id); return person && onSelectPerson ? () => onSelectPerson(person) : undefined; } if (task.entity_type === "company") { const company = companies.find((item) => item.id === task.entity_id); return company && onSelectCompany ? () => onSelectCompany(company) : undefined; } if (task.entity_type === "deal") { const deal = deals.find((item) => item.id === task.entity_id); return deal && onSelectDeal ? () => onSelectDeal(deal) : undefined; } }

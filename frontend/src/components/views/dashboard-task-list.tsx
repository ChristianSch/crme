"use client";

import { useState } from "react";

import { EmptyState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { DashboardTaskRow } from "@/components/views/dashboard-task-row";
import { useDashboardDealRelations, type DashboardDealRelations } from "@/hooks/use-dashboard-deal-relations";
import { Company, Deal, Person, Todo } from "@/lib/api";

export function DashboardTaskList({ tasks, people, companies, deals, onSelectTask, onSelectPerson, onSelectCompany, onSelectDeal, onOpenTasks }: { tasks: Todo[]; people: Person[]; companies: Company[]; deals: Deal[]; onSelectTask: (task: Todo) => void; onSelectPerson?: (person: Person) => void; onSelectCompany?: (company: Company) => void; onSelectDeal?: (deal: Deal) => void; onOpenTasks: () => void }) {
  const [taskPage, setTaskPage] = useState(0);
  const openTasks = tasks.filter((task) => task.status === "open");
  const urgentTasks = openTasks.filter((task) => task.priority === "urgent" || task.priority === "high");
  const sortedTasks = [...openTasks].sort(sortTasksForDashboard);
  const nowTasks = sortedTasks.filter(isNowTask);
  const nowTaskIds = new Set(nowTasks.map((task) => task.id));
  const laterTasks = sortedTasks.filter((task) => !nowTaskIds.has(task.id));
  const taskPageSize = 7;
  const taskPageCount = Math.max(1, Math.ceil(laterTasks.length / taskPageSize));
  const currentTaskPage = Math.min(taskPage, taskPageCount - 1);
  const visibleTasks = laterTasks.slice(currentTaskPage * taskPageSize, currentTaskPage * taskPageSize + taskPageSize);
  const dealRelations = useDashboardDealRelations([...nowTasks, ...visibleTasks]);

  return (
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
  );
}

function TaskGroup(props: { title: string; subtitle: string; count: number; tasks: Todo[]; people: Person[]; companies: Company[]; deals: Deal[]; dealRelations: DashboardDealRelations; emphasized?: boolean; onSelectTask: (task: Todo) => void; onSelectPerson?: (person: Person) => void; onSelectCompany?: (company: Company) => void; onSelectDeal?: (deal: Deal) => void }) {
  return <div className="border-b"><div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3.5"><div className="flex items-baseline gap-2"><h3 className="text-xs font-semibold text-muted-foreground">{props.title}</h3><span className="text-xs text-muted-foreground">{props.subtitle}</span></div><span className="text-xs tabular-nums text-muted-foreground">{props.count}</span></div><div className="divide-y border-t">{props.tasks.map((task) => <DashboardTaskRow key={task.id} task={task} people={props.people} companies={props.companies} deals={props.deals} emphasized={props.emphasized} onSelectTask={props.onSelectTask} onSelectPerson={props.onSelectPerson} onSelectCompany={props.onSelectCompany} onSelectDeal={props.onSelectDeal} dealRelations={task.entity_type === "deal" ? props.dealRelations[task.entity_id] : undefined} />)}</div></div>;
}

function DashboardPager({ page, pageCount, total, itemLabel, onPrevious, onNext }: { page: number; pageCount: number; total: number; itemLabel: string; onPrevious: () => void; onNext: () => void }) {
  return <div className="flex flex-col gap-2 border-t px-5 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{total} {itemLabel} · page {page + 1} of {pageCount}</span><div className="flex gap-2"><Button variant="outline" className="h-8 rounded-xl bg-background px-3 text-xs" disabled={page === 0} onClick={onPrevious}>Previous</Button><Button variant="outline" className="h-8 rounded-xl bg-background px-3 text-xs" disabled={page >= pageCount - 1} onClick={onNext}>Next</Button></div></div>;
}

function sortTasksForDashboard(a: Todo, b: Todo) {
  const rank = dashboardTaskRank(a) - dashboardTaskRank(b);
  if (rank !== 0) return rank;
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

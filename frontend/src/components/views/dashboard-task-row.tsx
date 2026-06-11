"use client";

import { type ReactNode } from "react";
import { LinkIcon } from "lucide-react";

import { Company, Deal, fullName, Person, Todo } from "@/lib/api";
import { firstUsefulLine, linkedEntityLabel, relativeDate, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DashboardTaskRow({ task, people, companies, deals, dealRelations, emphasized = false, onSelectTask, onSelectPerson, onSelectCompany, onSelectDeal }: { task: Todo; people: Person[]; companies: Company[]; deals: Deal[]; dealRelations?: { people: Person[]; companies: Company[] }; emphasized?: boolean; onSelectTask: (task: Todo) => void; onSelectPerson?: (person: Person) => void; onSelectCompany?: (company: Company) => void; onSelectDeal?: (deal: Deal) => void }) {
  const title = task.title || firstUsefulLine(task.body) || "Untitled task";
  const entityLabel = linkedEntityLabel(task, people, companies, deals);
  const linkedDeal = task.entity_type === "deal" ? deals.find((deal) => deal.id === task.entity_id) : undefined;
  const overdue = isOverdue(task.due_at);
  const dueToday = isDueToday(task.due_at);

  return (
    <div className={cn("grid gap-3 px-5 transition-colors hover:bg-muted/40 sm:grid-cols-[104px_minmax(0,1fr)_220px_104px] sm:items-center", emphasized ? "py-3.5" : "py-2.5")}>
      <button type="button" className="min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ring" onClick={() => onSelectTask(task)}>
        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", task.priority === "urgent" && "bg-[oklch(0.91_0.055_28)] text-[oklch(0.42_0.13_28)]", task.priority === "high" && "bg-[oklch(0.93_0.04_58)] text-[oklch(0.38_0.08_45)]", (task.priority === "normal" || task.priority === "low") && "text-muted-foreground")}>{task.priority || "normal"}</span>
      </button>
      <button type="button" className="min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ring" onClick={() => onSelectTask(task)}>
        <div className={cn("truncate font-medium tracking-[-0.01em]", emphasized ? "text-sm" : "text-[13px]")}>{title}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{task.body || "No details"}</div>
      </button>
      <div className="min-w-0 text-[13px] text-muted-foreground">
        {linkedDeal && dealRelations && (dealRelations.people.length || dealRelations.companies.length) ? (
          <div className="min-w-0 space-y-1">
            <DashboardEntityButton label={linkedDeal.name || "Unnamed deal"} icon={<LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />} onClick={onSelectDeal ? () => onSelectDeal(linkedDeal) : undefined} />
            <div className="flex min-w-0 flex-wrap gap-1">
              {dealRelations.people.map((person) => <DashboardRelationChip key={`person-${person.id}`} label={fullName(person)} onClick={onSelectPerson ? () => onSelectPerson(person) : undefined} />)}
              {dealRelations.companies.map((company) => <DashboardRelationChip key={`company-${company.id}`} label={company.name || company.domain || "Unnamed company"} onClick={onSelectCompany ? () => onSelectCompany(company) : undefined} />)}
            </div>
          </div>
        ) : (
          <DashboardEntityButton label={entityLabel} icon={<LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />} onClick={taskEntityHandler(task, people, companies, deals, onSelectPerson, onSelectCompany, onSelectDeal)} />
        )}
      </div>
      <button type="button" className="text-left focus:outline-none focus:ring-2 focus:ring-ring" onClick={() => onSelectTask(task)}>
        <div className={cn("text-[13px] font-medium", overdue && "text-[oklch(0.46_0.15_28)]", dueToday && "text-[oklch(0.42_0.11_55)]")}>{overdue ? "Overdue" : dueToday ? "Today" : relativeDate(task.due_at)}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{shortDate(task.due_at)}</div>
      </button>
    </div>
  );
}

function DashboardEntityButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick?: () => void }) {
  return onClick ? <button type="button" className="flex max-w-full items-center gap-1.5 text-left hover:underline focus:outline-none focus:ring-2 focus:ring-ring" onClick={onClick}>{icon}<span className="truncate">{label}</span></button> : <span className="flex max-w-full items-center gap-1.5">{icon}<span className="truncate">{label}</span></span>;
}

function DashboardRelationChip({ label, onClick }: { label: string; onClick?: () => void }) {
  return onClick ? <button type="button" className="max-w-full truncate rounded-lg bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" onClick={onClick}>{label}</button> : <span className="max-w-full truncate rounded-lg bg-muted px-2 py-0.5 text-xs text-muted-foreground">{label}</span>;
}

function taskEntityHandler(task: Todo, people: Person[], companies: Company[], deals: Deal[], onSelectPerson?: (person: Person) => void, onSelectCompany?: (company: Company) => void, onSelectDeal?: (deal: Deal) => void) {
  if (task.entity_type === "person") {
    const person = people.find((item) => item.id === task.entity_id);
    return person && onSelectPerson ? () => onSelectPerson(person) : undefined;
  }
  if (task.entity_type === "company") {
    const company = companies.find((item) => item.id === task.entity_id);
    return company && onSelectCompany ? () => onSelectCompany(company) : undefined;
  }
  if (task.entity_type === "deal") {
    const deal = deals.find((item) => item.id === task.entity_id);
    return deal && onSelectDeal ? () => onSelectDeal(deal) : undefined;
  }
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

"use client";

import { CheckCircle2, ChevronDown, Circle } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/data-state";
import { RowMenu } from "@/components/common/row-menu";
import { StatusBadge } from "@/components/common/status-badge";
import { Company, Deal, fullName, Person, Todo } from "@/lib/api";
import { firstUsefulLine, linkedEntityLabel, relativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TasksTable({
  tasks,
  people,
  companies,
  deals,
  onSelect,
  onSelectPerson,
  onSelectCompany,
  onSelectDeal,
}: {
  tasks: Todo[];
  people: Person[];
  companies: Company[];
  deals: Deal[];
  onSelect: (task: Todo) => void;
  onSelectPerson?: (person: Person) => void;
  onSelectCompany?: (company: Company) => void;
  onSelectDeal?: (deal: Deal) => void;
}) {
  if (!tasks.length) return <EmptyState title="No tasks found" body="Open tasks from the selected workspace will show here." />;

  return (
    <Table className="min-w-[860px]">
      <TableHeader>
        <TableRow className="bg-[oklch(0.975_0.004_255)] hover:bg-[oklch(0.975_0.004_255)]">
          <TableHead className="pl-7">Due</TableHead>
          <TableHead>Urgency</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[42%]">Task <ChevronDown className="ml-1 inline size-3" /></TableHead>
          <TableHead>Linked to</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id} className="h-[72px] cursor-pointer" onClick={() => onSelect(task)}>
            <TableCell className="pl-7 text-muted-foreground">{relativeDate(task.due_at)}</TableCell>
            <TableCell><PriorityIndicator priority={task.priority || "normal"} /></TableCell>
            <TableCell><StatusBadge value={task.status} tone={task.status === "done" ? "green" : "amber"} /></TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                {task.status === "done" ? <CheckCircle2 className="size-5 text-[oklch(0.55_0.12_155)]" /> : <Circle className="size-5 text-muted-foreground" />}
                <div className="min-w-0">
                  <div className="truncate font-medium leading-none">{task.title || firstUsefulLine(task.body) || "Untitled task"}</div>
                  <div className="mt-1 max-w-[54ch] truncate text-xs text-muted-foreground">{task.body || "No details"}</div>
                </div>
              </div>
            </TableCell>
            <TableCell><LinkedEntity task={task} people={people} companies={companies} deals={deals} onSelectPerson={onSelectPerson} onSelectCompany={onSelectCompany} onSelectDeal={onSelectDeal} /></TableCell>
            <TableCell><RowMenu /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PriorityIndicator({ priority }: { priority: Todo["priority"] }) {
  const label = priority === "urgent" ? "Urgent" : priority === "high" ? "High" : priority === "low" ? "Low" : "Normal";
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={cn(
        "size-2.5 rounded-full",
        priority === "urgent" && "bg-[oklch(0.58_0.17_28)]",
        priority === "high" && "bg-[oklch(0.68_0.12_48)]",
        priority === "normal" && "bg-[oklch(0.74_0.055_70)]",
        priority === "low" && "bg-[oklch(0.7_0.035_150)]",
      )} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function LinkedEntity({
  task,
  people,
  companies,
  deals,
  onSelectPerson,
  onSelectCompany,
  onSelectDeal,
}: {
  task: Todo;
  people: Person[];
  companies: Company[];
  deals: Deal[];
  onSelectPerson?: (person: Person) => void;
  onSelectCompany?: (company: Company) => void;
  onSelectDeal?: (deal: Deal) => void;
}) {
  if (task.entity_type === "person") {
    const person = people.find((item) => item.id === task.entity_id);
    if (!person) return <span className="text-muted-foreground">Unknown person</span>;
    if (!onSelectPerson) return <span className="max-w-[24ch] truncate font-medium">{fullName(person)}</span>;
    return (
      <button
        type="button"
        className="max-w-[24ch] truncate text-left font-medium underline-offset-4 hover:underline"
        onClick={(event) => {
          event.stopPropagation();
          onSelectPerson(person);
        }}
      >
        {fullName(person)}
      </button>
    );
  }

  if (task.entity_type === "company") {
    const company = companies.find((item) => item.id === task.entity_id);
    if (!company) return <span className="text-muted-foreground">Unknown company</span>;
    if (!onSelectCompany) return <span className="max-w-[24ch] truncate font-medium">{company.name || company.domain || "Unnamed company"}</span>;
    return (
      <button
        type="button"
        className="max-w-[24ch] truncate text-left font-medium underline-offset-4 hover:underline"
        onClick={(event) => {
          event.stopPropagation();
          onSelectCompany(company);
        }}
      >
        {company.name || company.domain || "Unnamed company"}
      </button>
    );
  }

  if (task.entity_type === "deal") {
    const deal = deals.find((item) => item.id === task.entity_id);
    if (!deal) return <span className="text-muted-foreground">Unknown deal</span>;
    if (!onSelectDeal) return <span className="max-w-[24ch] truncate font-medium">{deal.name || "Unnamed deal"}</span>;
    return (
      <button
        type="button"
        className="max-w-[24ch] truncate text-left font-medium underline-offset-4 hover:underline"
        onClick={(event) => {
          event.stopPropagation();
          onSelectDeal(deal);
        }}
      >
        {deal.name || "Unnamed deal"}
      </button>
    );
  }

  return <span className="text-muted-foreground">{linkedEntityLabel(task, people, companies, deals)}</span>;
}


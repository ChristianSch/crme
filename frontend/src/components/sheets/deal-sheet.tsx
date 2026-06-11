"use client";

import { useEffect, useState } from "react";
import { Building2, CalendarClock, CheckCircle2, Circle, LinkIcon, NotebookText, Pencil, Plus, Save, Trash2, Unlink, X, UserRound } from "lucide-react";

import { ActivityCard, ActivityComposer } from "@/components/activity/activity-components";
import { ConfirmAction } from "@/components/common/confirm-action";
import { Detail, SectionTitle } from "@/components/common/detail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Company, Deal, fullName, Person, TimelineItem, Todo } from "@/lib/api";
import { dateValue } from "@/lib/datetime";
import { formatMoney, relativeDate, searchable } from "@/lib/format";
import { cn } from "@/lib/utils";

type RelationLoadState = "idle" | "loading" | "ready" | "error";

export function DealSheet({
  deal,
  onOpenChange,
  people,
  companies,
  linkedPeople,
  linkedCompanies,
  relationState,
  tasks,
  timeline,
  onActivityCreated,
  onSelectPerson,
  onSelectCompany,
  onSaveDeal,
  onDeleteDeal,
  onLinkPerson,
  onUnlinkPerson,
  onLinkCompany,
  onUnlinkCompany,
  onCreateTask,
  onSaveTask,
  onCompleteTask,
}: {
  deal: Deal | null;
  onOpenChange: (open: boolean) => void;
  people: Person[];
  companies: Company[];
  linkedPeople: Person[];
  linkedCompanies: Company[];
  relationState: RelationLoadState;
  tasks: Todo[];
  timeline: TimelineItem[];
  onActivityCreated: () => void;
  onSelectPerson?: (person: Person) => void;
  onSelectCompany?: (company: Company) => void;
  onSaveDeal: (deal: Deal) => Promise<Deal>;
  onDeleteDeal: (deal: Deal) => Promise<void>;
  onLinkPerson: (personId: string) => Promise<void>;
  onUnlinkPerson: (personId: string) => Promise<void>;
  onLinkCompany: (companyId: string) => Promise<void>;
  onUnlinkCompany: (companyId: string) => Promise<void>;
  onCreateTask: (input: { title: string; body: string; due_at?: string }) => Promise<void>;
  onSaveTask: (task: Todo, changes: Partial<Todo>) => Promise<void>;
  onCompleteTask: (task: Todo) => Promise<void>;
}) {
  const [name, setName] = useState(deal?.name || "");
  const [stage, setStage] = useState(deal?.stage || "new");
  const [value, setValue] = useState(deal ? String(deal.value_cents / 100) : "0");
  const [currency, setCurrency] = useState(deal?.currency || "USD");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskBody, setTaskBody] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [personQuery, setPersonQuery] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [personLinkOpen, setPersonLinkOpen] = useState(false);
  const [companyLinkOpen, setCompanyLinkOpen] = useState(false);
  const [taskComposerOpen, setTaskComposerOpen] = useState(false);
  const relatedTasks = deal ? tasks.filter((task) => task.entity_type === "deal" && task.entity_id === deal.id) : [];
  const linkedPersonIds = new Set(linkedPeople.map((person) => person.id));
  const linkedCompanyIds = new Set(linkedCompanies.map((company) => company.id));
  const availablePeople = people
    .filter((person) => !linkedPersonIds.has(person.id))
    .filter((person) => !personQuery || searchable([fullName(person), person.email, person.title], personQuery))
    .slice(0, 30);
  const availableCompanies = companies
    .filter((company) => !linkedCompanyIds.has(company.id))
    .filter((company) => !companyQuery || searchable([company.name, company.domain], companyQuery))
    .slice(0, 30);
  const activities = timeline.filter((item) => item.kind === "activity" || item.type);
  const isRelationsLoading = relationState === "loading";
  const isRelationsError = relationState === "error";

  useEffect(() => {
    queueMicrotask(() => {
      setName(deal?.name || "");
      setStage(deal?.stage || "new");
      setValue(deal ? String(deal.value_cents / 100) : "0");
      setCurrency(deal?.currency || "USD");
      setTaskTitle("");
      setTaskBody("");
      setTaskDueDate("");
      setPersonQuery("");
      setCompanyQuery("");
      setDetailsOpen(false);
      setPersonLinkOpen(false);
      setCompanyLinkOpen(false);
      setTaskComposerOpen(false);
    });
  }, [deal]);

  async function saveDeal() {
    if (!deal) return;
    await onSaveDeal({
      ...deal,
      name,
      stage,
      value_cents: Math.round((Number.parseFloat(value) || 0) * 100),
      currency: normalizeCurrency(currency),
    });
    setDetailsOpen(false);
  }

  async function deleteDeal() {
    if (!deal) return;
    await onDeleteDeal(deal);
  }

  async function linkPerson() {
    if (!deal || !selectedPersonId) return;
    await onLinkPerson(selectedPersonId);
    setSelectedPersonId("");
    setPersonLinkOpen(false);
  }

  async function unlinkPerson(personId: string) {
    if (!deal) return;
    await onUnlinkPerson(personId);
  }

  async function linkCompany() {
    if (!deal || !selectedCompanyId) return;
    await onLinkCompany(selectedCompanyId);
    setSelectedCompanyId("");
    setCompanyLinkOpen(false);
  }

  async function unlinkCompany(companyId: string) {
    if (!deal) return;
    await onUnlinkCompany(companyId);
  }

  async function createTask() {
    if (!deal || (!taskTitle.trim() && !taskBody.trim())) return;
    await onCreateTask({
      title: taskTitle.trim(),
      body: taskBody.trim(),
      due_at: taskDueDate ? new Date(`${taskDueDate}T12:00:00`).toISOString() : undefined,
    });
    setTaskTitle("");
    setTaskBody("");
    setTaskDueDate("");
    setTaskComposerOpen(false);
  }

  async function saveTask(task: Todo, changes: Partial<Todo>) {
    await onSaveTask(task, changes);
  }

  async function completeTask(task: Todo) {
    await onCompleteTask(task);
  }

  return (
    <Sheet open={Boolean(deal)} onOpenChange={onOpenChange}>
      <SheetContent className="!w-[min(100vw,820px)] !max-w-none overflow-hidden p-0">
        {deal && (
          <div className="flex h-full flex-col bg-[oklch(0.985_0.004_255)]">
            <SheetHeader className="border-b py-6 pl-6 pr-16 text-left">
              <SheetTitle className="text-xl tracking-[-0.025em]">{deal.name || "Unnamed deal"}</SheetTitle>
              <SheetDescription>{formatMoney(deal.value_cents, deal.currency)} · {deal.stage}</SheetDescription>
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 px-6 py-6">
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <SectionTitle icon={<Circle className="size-4" />} title="Deal" />
                    <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" onClick={() => setDetailsOpen((open) => !open)}>{detailsOpen ? <X className="size-3.5" /> : <Pencil className="size-3.5" />} {detailsOpen ? "Close" : "Edit deal"}</Button>
                  </div>
                  <div className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    <Detail label="Stage" value={deal.stage} />
                    <Detail label="Value" value={formatMoney(deal.value_cents, deal.currency)} />
                  </div>
                  {detailsOpen && (
                    <div className="mt-3 rounded-2xl border bg-background p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Label htmlFor="deal-name" className="mb-1 text-xs font-medium text-muted-foreground">Deal name</Label>
                          <Input id="deal-name" value={name} onChange={(event) => setName(event.target.value)} className="h-9 rounded-xl bg-background" placeholder="Deal name" />
                        </div>
                        <div>
                          <Label className="mb-1 text-xs font-medium text-muted-foreground">Stage</Label>
                          <Select value={stage} onValueChange={setStage}>
                            <SelectTrigger className="h-9 rounded-xl bg-background shadow-none"><SelectValue placeholder="Stage" /></SelectTrigger>
                            <SelectContent align="start" position="popper" className="rounded-xl p-1">
                              {DEAL_STAGES.map((option) => <SelectItem key={option.value} value={option.value} className="rounded-lg py-2 pl-3 pr-8">{option.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="deal-value" className="mb-1 text-xs font-medium text-muted-foreground">Value</Label>
                          <Input id="deal-value" value={value} onChange={(event) => setValue(event.target.value)} className="h-9 rounded-xl bg-background" placeholder="0.00" inputMode="decimal" />
                        </div>
                        <div className="sm:max-w-40">
                          <Label className="mb-1 text-xs font-medium text-muted-foreground">Currency</Label>
                          <Select value={normalizeCurrency(currency)} onValueChange={setCurrency}>
                            <SelectTrigger className="h-9 rounded-xl bg-background shadow-none"><SelectValue placeholder="Currency" /></SelectTrigger>
                            <SelectContent align="start" position="popper" className="rounded-xl p-1">
                              {DEAL_CURRENCIES.map((option) => <SelectItem key={option} value={option} className="rounded-lg py-2 pl-3 pr-8">{option}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <ConfirmAction
                          title={`Delete ${deal.name || "this deal"}?`}
                          description="This removes the deal and its linked CRM context. This action cannot be undone."
                          actionLabel="Delete deal"
                          onConfirm={deleteDeal}
                          trigger={<Button size="sm" variant="outline" className="h-9 rounded-xl bg-background text-destructive sm:mr-auto"><Trash2 className="size-3.5" /> Delete</Button>}
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="h-9 rounded-xl bg-background" onClick={() => setDetailsOpen(false)}><X className="size-3.5" /> Cancel</Button>
                          <Button size="sm" className="h-9 rounded-xl" onClick={saveDeal}><Save className="size-3.5" /> Save deal</Button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
                <Separator />
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <SectionTitle icon={<UserRound className="size-4" />} title="People" />
                    <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" onClick={() => setPersonLinkOpen((open) => !open)}>{personLinkOpen ? <X className="size-3.5" /> : <LinkIcon className="size-3.5" />} {personLinkOpen ? "Close" : "Link person"}</Button>
                  </div>
                  <div className="mt-3 divide-y border-y">
                    {isRelationsLoading ? <RelationSkeleton /> : isRelationsError ? <RelationError /> : linkedPeople.length ? linkedPeople.map((person) => (
                      <div key={person.id} className="flex items-center justify-between gap-3 py-3">
                        {onSelectPerson ? (
                          <button type="button" className="min-w-0 text-left" onClick={() => onSelectPerson(person)}>
                            <div className="truncate text-sm font-medium hover:underline">{fullName(person)}</div>
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">{person.email || person.title || "No email"}</div>
                          </button>
                        ) : (
                          <div className="min-w-0 text-left">
                            <div className="truncate text-sm font-medium">{fullName(person)}</div>
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">{person.email || person.title || "No email"}</div>
                          </div>
                        )}
                        <ConfirmAction
                          title={`Unlink ${fullName(person)} from this deal?`}
                          description="This only removes the relationship. The person and deal records stay in CRMe."
                          actionLabel="Unlink person"
                          onConfirm={() => unlinkPerson(person.id)}
                          trigger={<Button size="sm" variant="ghost" className="h-8 rounded-xl text-muted-foreground"><Unlink className="size-3.5" /> Unlink</Button>}
                        />
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No people linked to this deal.</p>}
                  </div>
                  {personLinkOpen && (
                    <div className="mt-3 rounded-2xl border bg-[oklch(0.97_0.018_58)] p-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <Input value={personQuery} onChange={(event) => setPersonQuery(event.target.value)} placeholder="Search people" className="h-9 rounded-xl bg-background" />
                        <Button size="sm" variant="outline" className="h-9 rounded-xl bg-background" disabled={!selectedPersonId} onClick={linkPerson}><LinkIcon className="size-3.5" /> Link</Button>
                      </div>
                      <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                        {availablePeople.map((person) => (
                          <button key={person.id} type="button" className={cn("w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-background", selectedPersonId === person.id && "bg-background")} onClick={() => setSelectedPersonId(person.id)}>
                            <span className="block truncate font-medium">{fullName(person)}</span>
                            <span className="block truncate text-xs text-muted-foreground">{person.email || person.title || "No email"}</span>
                          </button>
                        ))}
                        {!availablePeople.length && <p className="px-3 py-4 text-sm text-muted-foreground">No people found.</p>}
                      </div>
                    </div>
                  )}
                </section>
                <Separator />
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <SectionTitle icon={<Building2 className="size-4" />} title="Companies" />
                    <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" onClick={() => setCompanyLinkOpen((open) => !open)}>{companyLinkOpen ? <X className="size-3.5" /> : <LinkIcon className="size-3.5" />} {companyLinkOpen ? "Close" : "Link company"}</Button>
                  </div>
                  <div className="mt-3 divide-y border-y">
                    {isRelationsLoading ? <RelationSkeleton /> : isRelationsError ? <RelationError /> : linkedCompanies.length ? linkedCompanies.map((company) => (
                      <div key={company.id} className="flex items-center justify-between gap-3 py-3">
                        {onSelectCompany ? (
                          <button type="button" className="min-w-0 text-left" onClick={() => onSelectCompany(company)}>
                            <div className="truncate text-sm font-medium hover:underline">{company.name || "Unnamed company"}</div>
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">{company.domain || "No domain"}</div>
                          </button>
                        ) : (
                          <div className="min-w-0 text-left">
                            <div className="truncate text-sm font-medium">{company.name || "Unnamed company"}</div>
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">{company.domain || "No domain"}</div>
                          </div>
                        )}
                        <ConfirmAction
                          title={`Unlink ${company.name || "this company"} from this deal?`}
                          description="This only removes the relationship. The company and deal records stay in CRMe."
                          actionLabel="Unlink company"
                          onConfirm={() => unlinkCompany(company.id)}
                          trigger={<Button size="sm" variant="ghost" className="h-8 rounded-xl text-muted-foreground"><Unlink className="size-3.5" /> Unlink</Button>}
                        />
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No companies linked to this deal.</p>}
                  </div>
                  {companyLinkOpen && (
                    <div className="mt-3 rounded-2xl border bg-[oklch(0.97_0.018_58)] p-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <Input value={companyQuery} onChange={(event) => setCompanyQuery(event.target.value)} placeholder="Search companies" className="h-9 rounded-xl bg-background" />
                        <Button size="sm" variant="outline" className="h-9 rounded-xl bg-background" disabled={!selectedCompanyId} onClick={linkCompany}><LinkIcon className="size-3.5" /> Link</Button>
                      </div>
                      <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                        {availableCompanies.map((company) => (
                          <button key={company.id} type="button" className={cn("w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-background", selectedCompanyId === company.id && "bg-background")} onClick={() => setSelectedCompanyId(company.id)}>
                            <span className="block truncate font-medium">{company.name || "Unnamed company"}</span>
                            <span className="block truncate text-xs text-muted-foreground">{company.domain || "No domain"}</span>
                          </button>
                        ))}
                        {!availableCompanies.length && <p className="px-3 py-4 text-sm text-muted-foreground">No companies found.</p>}
                      </div>
                    </div>
                  )}
                </section>
                <Separator />
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <SectionTitle icon={<CalendarClock className="size-4" />} title="Tasks" />
                    <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" onClick={() => setTaskComposerOpen((open) => !open)}>{taskComposerOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />} {taskComposerOpen ? "Close" : "Add task"}</Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {isRelationsLoading ? <RelationSkeleton /> : isRelationsError ? <RelationError /> : relatedTasks.length ? relatedTasks.map((task) => (
                      <DealTaskEditor key={task.id} task={task} onSave={saveTask} onComplete={completeTask} />
                    )) : <p className="text-sm text-muted-foreground">No tasks linked to this deal.</p>}
                  </div>
                  {taskComposerOpen && <div className="mt-3 rounded-2xl border bg-[oklch(0.97_0.018_58)] p-3">
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} className="h-9 rounded-xl bg-background" placeholder="New task" />
                      <Input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} className="h-9 rounded-xl bg-background sm:w-40" />
                    </div>
                    <Textarea value={taskBody} onChange={(event) => setTaskBody(event.target.value)} className="mt-2 min-h-20 rounded-xl bg-background" placeholder="Details, optional" />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="h-9 rounded-xl bg-background" onClick={() => setTaskComposerOpen(false)}><X className="size-3.5" /> Cancel</Button>
                      <Button size="sm" className="h-9 rounded-xl" disabled={!taskTitle.trim() && !taskBody.trim()} onClick={createTask}><Plus className="size-3.5" /> Create task</Button>
                    </div>
                  </div>}
                </section>
                <Separator />
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <SectionTitle icon={<NotebookText className="size-4" />} title="Activities" />
                    <ActivityComposer entityType="deal" entityId={deal.id} onCreated={onActivityCreated} />
                  </div>
                  <div className="mt-3 space-y-2">
                    {activities.length ? activities.map((activity) => <ActivityCard key={activity.id} item={activity} onSaved={onActivityCreated} />) : <p className="text-sm text-muted-foreground">No activities linked to this deal.</p>}
                  </div>
                </section>
              </div>
            </ScrollArea>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

const DEAL_CURRENCIES = ["EUR", "USD", "GBP", "CHF"];

function normalizeCurrency(value: string) {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "USD";
}

const DEAL_STAGES = [
  { value: "new", label: "New" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

function RelationSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-16 rounded-2xl" />
    </div>
  );
}

function RelationError() {
  return <p className="text-sm text-destructive">Could not load linked records. Try closing and reopening this deal.</p>;
}

function DealTaskEditor({ task, onSave, onComplete }: { task: Todo; onSave: (task: Todo, changes: Partial<Todo>) => Promise<void>; onComplete: (task: Todo) => Promise<void> }) {
  const [title, setTitle] = useState(task.title);
  const [body, setBody] = useState(task.body);
  const [dueDate, setDueDate] = useState(task.due_at ? dateValue(task.due_at) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setTitle(task.title);
      setBody(task.body);
      setDueDate(task.due_at ? dateValue(task.due_at) : "");
    });
  }, [task]);

  async function save() {
    setSaving(true);
    try {
      await onSave(task, {
        title: title.trim(),
        body: body.trim(),
        due_at: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : undefined,
      } as Partial<Todo>);
    } finally {
      setSaving(false);
    }
  }

  async function complete() {
    setSaving(true);
    try {
      await onComplete(task);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} className="h-9 rounded-xl bg-background" placeholder="Untitled task" />
        <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-9 rounded-xl bg-background sm:w-40" />
      </div>
      <Textarea value={body} onChange={(event) => setBody(event.target.value)} className="mt-2 min-h-16 rounded-xl bg-background" placeholder="Details" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{task.status} · Due {relativeDate(task.due_at)}</span>
        <div className="flex gap-2">
          {task.status !== "done" && <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" disabled={saving} onClick={complete}><CheckCircle2 className="size-3.5" /> Complete</Button>}
          <Button size="sm" className="h-8 rounded-xl" disabled={saving} onClick={save}><Save className="size-3.5" /> {saving ? "Saving..." : "Save"}</Button>
        </div>
      </div>
    </div>
  );
}


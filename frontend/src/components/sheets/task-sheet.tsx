"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, CalendarClock, LinkIcon, NotebookText, Pencil, RotateCcw, Save, Trash2, X, UserRound, Circle } from "lucide-react";

import { ConfirmAction } from "@/components/common/confirm-action";
import { Detail, SectionTitle } from "@/components/common/detail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api, Company, Deal, fullName, Person, Todo } from "@/lib/api";
import { dateValue } from "@/lib/datetime";
import { firstUsefulLine, linkedEntityLabel, relativeDate, searchable, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const TASK_PRIORITIES: Array<{ value: Todo["priority"]; label: string }> = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

const TASK_STATUSES: Array<{ value: Todo["status"]; label: string }> = [
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
];

const PERSON_SEARCH_LIMIT = 100;

function priorityLabel(priority: Todo["priority"]) {
  return TASK_PRIORITIES.find((item) => item.value === priority)?.label ?? "Normal";
}

export function TaskSheet({
  task,
  onOpenChange,
  people,
  companies,
  deals,
  workspaceId = "",
  onSaveTask,
  onDeleteTask,
  onSelectPerson,
  onSelectCompany,
  onSelectDeal,
}: {
  task: Todo | null;
  onOpenChange: (open: boolean) => void;
  people: Person[];
  companies: Company[];
  deals: Deal[];
  workspaceId?: string;
  onSaveTask: (task: Todo, changes: Partial<Todo>) => Promise<Todo>;
  onDeleteTask: (task: Todo) => Promise<void>;
  onSelectPerson?: (person: Person) => void;
  onSelectCompany?: (company: Company) => void;
  onSelectDeal?: (deal: Deal) => void;
}) {
  const linkedTo = task ? linkedEntityLabel(task, people, companies, deals) : "";
  const [personQuery, setPersonQuery] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [dealQuery, setDealQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [personLinkOpen, setPersonLinkOpen] = useState(false);
  const [personSearchResults, setPersonSearchResults] = useState<Person[]>(people);
  const [personSearchLoading, setPersonSearchLoading] = useState(false);
  const [personSearchHasMore, setPersonSearchHasMore] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedDealId, setSelectedDealId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Todo["priority"]>("normal");
  const [status, setStatus] = useState<Todo["status"]>("open");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingOpen, setEditingOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setPersonQuery("");
      setPersonLinkOpen(false);
      setPersonSearchResults([]);
      setPersonSearchHasMore(false);
      setCompanyQuery("");
      setDealQuery("");
      setSelectedPersonId(task?.entity_type === "person" ? task.entity_id : "");
      setSelectedCompanyId(task?.entity_type === "company" ? task.entity_id : "");
      setSelectedDealId(task?.entity_type === "deal" ? task.entity_id : "");
      setTitle(task?.title ?? "");
      setBody(task?.body ?? "");
      setDueDate(task?.due_at ? dateValue(task.due_at) : "");
      setPriority(task?.priority || "normal");
      setStatus(task?.status || "open");
      setError("");
      setEditingOpen(false);
    });
  }, [task]);


  useEffect(() => {
    if (!personLinkOpen) return;
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setPersonSearchLoading(true);
      try {
        const results = await api.people(personQuery.trim(), workspaceId, PERSON_SEARCH_LIMIT, 0);
        if (!cancelled) {
          setPersonSearchResults(results ?? []);
          setPersonSearchHasMore((results ?? []).length === PERSON_SEARCH_LIMIT);
        }
      } catch {
        if (!cancelled) {
          const fallback = people.filter((person) => !personQuery || searchable([fullName(person), person.email], personQuery));
          setPersonSearchResults(fallback.slice(0, PERSON_SEARCH_LIMIT));
          setPersonSearchHasMore(fallback.length > PERSON_SEARCH_LIMIT);
        }
      } finally {
        if (!cancelled) setPersonSearchLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [people, personLinkOpen, personQuery, workspaceId]);

  const personOptions = personSearchResults;
  const companyOptions = companies
    .filter((company) => !companyQuery || searchable([company.name, company.domain], companyQuery))
    .slice(0, 30);
  const dealOptions = deals
    .filter((deal) => !dealQuery || searchable([deal.name, deal.stage], dealQuery))
    .slice(0, 30);
  const linkedPerson = task?.entity_type === "person" ? people.find((person) => person.id === task.entity_id) : undefined;
  const linkedCompany = task?.entity_type === "company" ? companies.find((company) => company.id === task.entity_id) : undefined;
  const linkedDeal = task?.entity_type === "deal" ? deals.find((deal) => deal.id === task.entity_id) : undefined;

  async function saveTask(changes: Partial<Todo>) {
    if (!task) return;
    setSaving(true);
    setError("");
    try {
      await onSaveTask(task, changes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save task");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdits() {
    await saveTask({
      title: title.trim(),
      body: body.trim(),
      due_at: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : undefined,
      priority,
      status,
    });
    setEditingOpen(false);
  }

  async function linkToPerson() {
    if (!selectedPersonId) return;
    await saveTask({ entity_type: "person", entity_id: selectedPersonId });
    setPersonLinkOpen(false);
  }

  async function loadMorePeople() {
    setPersonSearchLoading(true);
    try {
      const results = await api.people(personQuery.trim(), workspaceId, PERSON_SEARCH_LIMIT, personSearchResults.length);
      setPersonSearchResults((current) => [...current, ...(results ?? [])]);
      setPersonSearchHasMore((results ?? []).length === PERSON_SEARCH_LIMIT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more people");
    } finally {
      setPersonSearchLoading(false);
    }
  }

  async function linkToCompany() {
    if (!selectedCompanyId) return;
    await saveTask({ entity_type: "company", entity_id: selectedCompanyId });
  }

  async function linkToDeal() {
    if (!selectedDealId) return;
    await saveTask({ entity_type: "deal", entity_id: selectedDealId });
  }

  async function unlinkTask() {
    await saveTask({ entity_type: "", entity_id: "" });
  }

  async function toggleStatus() {
    if (!task) return;
    await saveTask({ status: task.status === "done" ? "open" : "done" });
  }

  async function deleteTask() {
    if (!task) return;
    setSaving(true);
    try {
      await onDeleteTask(task);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={Boolean(task)} onOpenChange={onOpenChange}>
      <SheetContent className="!w-[min(100vw,720px)] !max-w-none overflow-hidden p-0">
        {task && (
          <div className="flex h-full flex-col bg-[oklch(0.985_0.004_255)]">
            <SheetHeader className="border-b py-6 pl-6 pr-16 text-left">
              <SheetTitle className="break-words text-xl tracking-[-0.025em]">{task.title || firstUsefulLine(task.body) || "Untitled task"}</SheetTitle>
              <SheetDescription>{linkedTo}</SheetDescription>
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 px-6 py-6">
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <SectionTitle icon={<CalendarClock className="size-4" />} title="Task" />
                    <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" onClick={() => setEditingOpen((open) => !open)}>{editingOpen ? <X className="size-3.5" /> : <Pencil className="size-3.5" />} {editingOpen ? "Close" : "Edit task"}</Button>
                  </div>
                  <div className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    <Detail label="Status" value={task.status} />
                    <Detail label="Due" value={relativeDate(task.due_at)} />
                    <Detail label="Priority" value={priorityLabel(task.priority || "normal")} />
                    <Detail label="Linked to">
                      {linkedPerson && onSelectPerson ? (
                        <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => onSelectPerson(linkedPerson)}>{fullName(linkedPerson)}</button>
                      ) : linkedPerson ? (
                        <span>{fullName(linkedPerson)}</span>
                      ) : linkedCompany && onSelectCompany ? (
                        <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => onSelectCompany(linkedCompany)}>{linkedCompany.name || linkedCompany.domain || "Unnamed company"}</button>
                      ) : linkedCompany ? (
                        <span>{linkedCompany.name || linkedCompany.domain || "Unnamed company"}</span>
                      ) : linkedDeal && onSelectDeal ? (
                        <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => onSelectDeal(linkedDeal)}>{linkedDeal.name || "Unnamed deal"}</button>
                      ) : linkedDeal ? (
                        <span>{linkedDeal.name || "Unnamed deal"}</span>
                      ) : (
                        <span>{linkedTo}</span>
                      )}
                    </Detail>
                    <Detail label="Created" value={shortDate(task.created_at)} />
                  </div>
                  {error && <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" disabled={saving} onClick={toggleStatus}>{task.status === "done" ? <RotateCcw className="size-3.5" /> : <CheckCircle2 className="size-3.5" />} {task.status === "done" ? "Reopen" : "Complete"}</Button>
                    <ConfirmAction
                      title="Delete this task?"
                      description="This removes the task from CRMe. This action cannot be undone."
                      actionLabel="Delete task"
                      onConfirm={deleteTask}
                      trigger={<Button size="sm" variant="outline" className="h-8 rounded-xl bg-background text-destructive" disabled={saving}><Trash2 className="size-3.5" /> Delete</Button>}
                    />
                  </div>
                  {editingOpen && (
                    <div className="mt-4 grid gap-4 rounded-2xl border bg-background p-4 shadow-sm">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
                          <Input value={title} onChange={(event) => setTitle(event.target.value)} className="h-9 rounded-xl bg-background" placeholder="Task title" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                          <Select value={status} onValueChange={(value) => setStatus(value as Todo["status"])}>
                            <SelectTrigger className="h-9 rounded-xl bg-background shadow-none"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent align="start" position="popper" className="rounded-xl p-1">
                              {TASK_STATUSES.map((option) => <SelectItem key={option.value} value={option.value} className="rounded-lg py-2 pl-3 pr-8">{option.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
                          <Select value={priority} onValueChange={(value) => setPriority(value as Todo["priority"])}>
                            <SelectTrigger className="h-9 rounded-xl bg-background shadow-none"><SelectValue placeholder="Priority" /></SelectTrigger>
                            <SelectContent align="start" position="popper" className="rounded-xl p-1">
                              {TASK_PRIORITIES.map((option) => <SelectItem key={option.value} value={option.value} className="rounded-lg py-2 pl-3 pr-8">{option.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Due date</label>
                          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-9 rounded-xl bg-background" />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Details</label>
                        <Textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-24 rounded-xl bg-background" placeholder="Details" />
                      </div>
                      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                        <Button size="sm" variant="outline" className="h-9 rounded-xl bg-background" disabled={saving} onClick={() => setEditingOpen(false)}><X className="size-3.5" /> Cancel</Button>
                        <Button size="sm" className="h-9 rounded-xl" disabled={saving || (!title.trim() && !body.trim())} onClick={saveEdits}><Save className="size-3.5" /> {saving ? "Saving..." : "Save task"}</Button>
                      </div>
                    </div>
                  )}
                </section>
                <Separator />
                <section>
                  <SectionTitle icon={<LinkIcon className="size-4" />} title="Relationship" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Popover open={personLinkOpen} onOpenChange={setPersonLinkOpen}>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background"><UserRound className="size-3.5" /> Link to person</Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" side="top" sideOffset={8} collisionPadding={16} className="flex max-h-[min(420px,var(--radix-popover-content-available-height),calc(100vh-2rem))] w-[min(360px,var(--radix-popover-content-available-width),calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl p-3">
                        <div className="flex min-h-0 flex-1 flex-col gap-2">
                          <div>
                            <div className="text-sm font-medium">Link task to person</div>
                            <p className="text-xs text-muted-foreground">Move this task onto a person record.</p>
                          </div>
                          <Input value={personQuery} onChange={(event) => setPersonQuery(event.target.value)} placeholder="Search people" className="h-9 rounded-xl" />
                          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                            <div className="space-y-1">
                              {personOptions.map((person) => (
                                <button key={person.id} type="button" className={cn("w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted", selectedPersonId === person.id && "bg-muted")} onClick={() => setSelectedPersonId(person.id)}>
                                  <span className="block truncate font-medium">{fullName(person)}</span>
                                  <span className="block truncate text-xs text-muted-foreground">{person.email || "No email"}</span>
                                </button>
                              ))}
                              {personSearchLoading && !personOptions.length && <p className="px-3 py-4 text-sm text-muted-foreground">Searching people...</p>}
                              {!personSearchLoading && !personOptions.length && <p className="px-3 py-4 text-sm text-muted-foreground">No people found.</p>}
                              {personSearchHasMore && <Button type="button" size="sm" variant="outline" className="mt-1 h-8 w-full rounded-xl bg-background" disabled={personSearchLoading} onClick={loadMorePeople}>{personSearchLoading ? "Loading..." : "Load more people"}</Button>}
                            </div>
                          </div>
                          <Button size="sm" className="h-9 w-full shrink-0 rounded-xl" disabled={saving || !selectedPersonId} onClick={linkToPerson}><LinkIcon className="size-3.5" /> Link person</Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background"><Building2 className="size-3.5" /> Link to company</Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" sideOffset={8} collisionPadding={16} className="flex max-h-[min(420px,var(--radix-popover-content-available-height),calc(100vh-2rem))] w-[min(360px,var(--radix-popover-content-available-width),calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl p-3">
                        <div className="flex min-h-0 flex-1 flex-col gap-2">
                          <div>
                            <div className="text-sm font-medium">Link task to company</div>
                            <p className="text-xs text-muted-foreground">Move this task onto a company record.</p>
                          </div>
                          <Input value={companyQuery} onChange={(event) => setCompanyQuery(event.target.value)} placeholder="Search companies" className="h-9 rounded-xl" />
                          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                            <div className="space-y-1">
                              {companyOptions.map((company) => (
                                <button key={company.id} type="button" className={cn("w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted", selectedCompanyId === company.id && "bg-muted")} onClick={() => setSelectedCompanyId(company.id)}>
                                  <span className="block truncate font-medium">{company.name || "Unnamed company"}</span>
                                  <span className="block truncate text-xs text-muted-foreground">{company.domain || "No domain"}</span>
                                </button>
                              ))}
                              {!companyOptions.length && <p className="px-3 py-4 text-sm text-muted-foreground">No companies found.</p>}
                            </div>
                          </div>
                          <Button size="sm" className="h-9 w-full shrink-0 rounded-xl" disabled={saving || !selectedCompanyId} onClick={linkToCompany}><LinkIcon className="size-3.5" /> Link company</Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background"><Circle className="size-3.5" /> Link to deal</Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" sideOffset={8} collisionPadding={16} className="flex max-h-[min(420px,var(--radix-popover-content-available-height),calc(100vh-2rem))] w-[min(360px,var(--radix-popover-content-available-width),calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl p-3">
                        <div className="flex min-h-0 flex-1 flex-col gap-2">
                          <div>
                            <div className="text-sm font-medium">Link task to deal</div>
                            <p className="text-xs text-muted-foreground">Move this task onto a deal record.</p>
                          </div>
                          <Input value={dealQuery} onChange={(event) => setDealQuery(event.target.value)} placeholder="Search deals" className="h-9 rounded-xl" />
                          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                            <div className="space-y-1">
                              {dealOptions.map((deal) => (
                                <button key={deal.id} type="button" className={cn("w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted", selectedDealId === deal.id && "bg-muted")} onClick={() => setSelectedDealId(deal.id)}>
                                  <span className="block truncate font-medium">{deal.name || "Unnamed deal"}</span>
                                  <span className="block truncate text-xs text-muted-foreground">{deal.stage || "No stage"}</span>
                                </button>
                              ))}
                              {!dealOptions.length && <p className="px-3 py-4 text-sm text-muted-foreground">No deals found.</p>}
                            </div>
                          </div>
                          <Button size="sm" className="h-9 w-full shrink-0 rounded-xl" disabled={saving || !selectedDealId} onClick={linkToDeal}><LinkIcon className="size-3.5" /> Link deal</Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                    {task.entity_type && (
                      <Button size="sm" variant="ghost" className="h-8 rounded-xl text-muted-foreground" disabled={saving} onClick={unlinkTask}>Unlink</Button>
                    )}
                  </div>
                </section>
                <Separator />
                <section>
                  <SectionTitle icon={<NotebookText className="size-4" />} title="Details" />
                  <div className="mt-3 border-y py-3">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">{task.body || "No details"}</p>
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

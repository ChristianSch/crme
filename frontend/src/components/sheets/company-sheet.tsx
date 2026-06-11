"use client";

import { useState } from "react";
import { Building2, CalendarClock, CheckCircle2, Handshake, Pencil, Plus, RotateCcw, Save, Trash2, X, NotebookText, UserRound } from "lucide-react";

import { ActivityCard, ActivityComposer } from "@/components/activity/activity-components";
import { ConfirmAction } from "@/components/common/confirm-action";
import { Detail, PersonField, SectionTitle } from "@/components/common/detail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Company, Deal, fullName, Person, TimelineItem, Todo } from "@/lib/api";
import { firstUsefulLine, relativeDate } from "@/lib/format";

export function CompanySheet({
  company,
  onOpenChange,
  people,
  deals,
  tasks,
  timeline,
  onActivityCreated,
  onSave,
  onDelete,
  onCreateTask,
  onToggleTask,
  onSelectPerson,
  onSelectDeal,
}: {
  company: Company | null;
  onOpenChange: (open: boolean) => void;
  people: Person[];
  deals: Deal[];
  tasks: Todo[];
  timeline: TimelineItem[];
  onActivityCreated: () => void;
  onSave: (company: Company) => Promise<Company>;
  onDelete: (company: Company) => Promise<void>;
  onCreateTask: (input: { title: string; body: string; due_at?: string }) => Promise<void>;
  onToggleTask: (task: Todo) => Promise<void>;
  onSelectPerson?: (person: Person) => void;
  onSelectDeal?: (deal: Deal) => void;
}) {
  const [editingId, setEditingId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Company>>({});
  const [taskTitle, setTaskTitle] = useState("");
  const [taskBody, setTaskBody] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskComposerOpen, setTaskComposerOpen] = useState(false);
  const editing = Boolean(company && editingId === company.id);
  const draft = company ? drafts[company.id] ?? company : null;
  const setDraft = (next: Company) => {
    setDrafts((current) => ({ ...current, [next.id]: next }));
  };
  const relatedPeople = company ? people : [];
  const relatedDeals = company ? deals : [];
  const relatedTasks = company ? tasks.filter((task) => task.entity_type === "company" && task.entity_id === company.id) : [];
  const activities = timeline.filter((item) => item.kind === "activity" || item.type);

  async function saveCompany() {
    if (!draft) return;
    setSaving(true);
    try {
      await onSave(draft);
      setEditingId("");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCompany() {
    if (!company) return;
    await onDelete(company);
  }

  async function createTask() {
    if (!company || (!taskTitle.trim() && !taskBody.trim())) return;
    setTaskBusy(true);
    try {
      await onCreateTask({
        title: taskTitle.trim(),
        body: taskBody.trim(),
        due_at: taskDueDate ? new Date(`${taskDueDate}T12:00:00`).toISOString() : undefined,
      });
      setTaskTitle("");
      setTaskBody("");
      setTaskDueDate("");
      setTaskComposerOpen(false);
    } finally {
      setTaskBusy(false);
    }
  }

  async function completeTask(task: Todo) {
    await onToggleTask(task);
  }

  return (
    <Sheet open={Boolean(company)} onOpenChange={onOpenChange}>
      <SheetContent className="!w-[min(100vw,820px)] !max-w-none overflow-hidden p-0">
        {company && draft && (
          <div className="flex h-full flex-col bg-[oklch(0.985_0.004_255)]">
            <SheetHeader className="border-b py-6 pl-6 pr-16 text-left">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-xl tracking-[-0.025em]">{company.name || "Unnamed company"}</SheetTitle>
                  <SheetDescription>{company.domain || "No domain"}</SheetDescription>
                </div>
                <div className="flex shrink-0 gap-2">
                  {editing ? (
                    <>
                      <Button variant="outline" size="sm" className="h-9 rounded-xl bg-background" disabled={saving} onClick={() => { setDraft(company); setEditingId(""); }}><X className="size-3.5" /> Cancel</Button>
                      <Button size="sm" className="h-9 rounded-xl" disabled={saving || !draft.name.trim()} onClick={saveCompany}><Save className="size-3.5" /> {saving ? "Saving..." : "Save"}</Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" className="h-9 rounded-xl bg-background" onClick={() => { setDraft(company); setEditingId(company.id); }}><Pencil className="size-3.5" /> Edit</Button>
                  )}
                </div>
              </div>
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 px-6 py-6">
                <section>
                  <SectionTitle icon={<Building2 className="size-4" />} title="Company" />
                  {editing ? (
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <PersonField label="Name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
                      <PersonField label="Domain" value={draft.domain} onChange={(value) => setDraft({ ...draft, domain: value })} />
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                      <Detail label="Domain" value={company.domain || "No domain"} />
                      <Detail label="Last touch" value={relativeDate(company.last_touch_at)} />
                    </div>
                  )}
                  {!editing && (
                    <div className="mt-3 flex justify-end">
                      <ConfirmAction
                        title={`Delete ${company.name || "this company"}?`}
                        description="This removes the company and its CRM relationships. This action cannot be undone."
                        actionLabel="Delete company"
                        onConfirm={deleteCompany}
                        trigger={<Button size="sm" variant="outline" className="h-8 rounded-xl bg-background text-destructive"><Trash2 className="size-3.5" /> Delete</Button>}
                      />
                    </div>
                  )}
                </section>
                <Separator />
                <section>
                  <SectionTitle icon={<UserRound className="size-4" />} title="People" />
                  <div className="mt-3 divide-y border-y">
                    {relatedPeople.length ? relatedPeople.map((person) => {
                      const content = (
                        <>
                          <div className="truncate text-sm font-medium underline-offset-4 group-hover:underline">{fullName(person)}</div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">{person.email || "No email"}</div>
                        </>
                      );
                      return onSelectPerson ? (
                        <button key={person.id} type="button" className="group w-full py-3 text-left hover:bg-muted/30" onClick={() => onSelectPerson(person)}>{content}</button>
                      ) : (
                        <div key={person.id} className="w-full py-3 text-left">{content}</div>
                      );
                    }) : <p className="text-sm text-muted-foreground">No linked people loaded.</p>}
                  </div>
                </section>
                <Separator />
                <section>
                  <SectionTitle icon={<Handshake className="size-4" />} title="Deals" />
                  <div className="mt-3 divide-y border-y">
                    {relatedDeals.length ? relatedDeals.map((deal) => {
                      const content = (
                        <>
                          <div className="truncate text-sm font-medium underline-offset-4 group-hover:underline">{deal.name || "Unnamed deal"}</div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">{deal.stage || "No stage"}</div>
                        </>
                      );
                      return onSelectDeal ? (
                        <button key={deal.id} type="button" className="group w-full py-3 text-left hover:bg-muted/30" onClick={() => onSelectDeal(deal)}>{content}</button>
                      ) : (
                        <div key={deal.id} className="w-full py-3 text-left">{content}</div>
                      );
                    }) : <p className="text-sm text-muted-foreground">No linked deals loaded.</p>}
                  </div>
                </section>
                <Separator />
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <SectionTitle icon={<CalendarClock className="size-4" />} title="Tasks" />
                    <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" onClick={() => setTaskComposerOpen((open) => !open)}>{taskComposerOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />} {taskComposerOpen ? "Close" : "Add task"}</Button>
                  </div>
                  <div className="mt-3 divide-y border-y">
                    {relatedTasks.length ? relatedTasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{task.title || firstUsefulLine(task.body) || "Untitled task"}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">Due {relativeDate(task.due_at)}</div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-8 rounded-xl text-muted-foreground" disabled={taskBusy} onClick={() => completeTask(task)}>{task.status === "done" ? <RotateCcw className="size-3.5" /> : <CheckCircle2 className="size-3.5" />} {task.status === "done" ? "Reopen" : "Complete"}</Button>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No tasks linked to this company.</p>}
                  </div>
                  {taskComposerOpen && (
                    <div className="mt-3 rounded-2xl border bg-[oklch(0.97_0.018_58)] p-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} className="h-9 rounded-xl bg-background" placeholder="New task" />
                        <Input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} className="h-9 rounded-xl bg-background sm:w-40" />
                      </div>
                      <Textarea value={taskBody} onChange={(event) => setTaskBody(event.target.value)} className="mt-2 min-h-20 rounded-xl bg-background" placeholder="Details, optional" />
                      <div className="mt-2 flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="h-9 rounded-xl bg-background" disabled={taskBusy} onClick={() => setTaskComposerOpen(false)}><X className="size-3.5" /> Cancel</Button>
                        <Button size="sm" className="h-9 rounded-xl" disabled={taskBusy || (!taskTitle.trim() && !taskBody.trim())} onClick={createTask}><Plus className="size-3.5" /> {taskBusy ? "Creating..." : "Create task"}</Button>
                      </div>
                    </div>
                  )}
                </section>
                <Separator />
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <SectionTitle icon={<NotebookText className="size-4" />} title="Activities" />
                    <ActivityComposer entityType="company" entityId={company.id} onCreated={onActivityCreated} />
                  </div>
                  <div className="mt-3 space-y-2">
                    {activities.length ? activities.map((activity) => (
                      <ActivityCard key={activity.id} item={activity} onSaved={onActivityCreated} />
                    )) : <p className="text-sm text-muted-foreground">No activities linked to this company.</p>}
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


"use client";

import { useState } from "react";
import { Ban, Building2, CalendarClock, CheckCircle2, Flag, LinkIcon, Mail, NotebookText, Pencil, Plus, RotateCcw, Save, Trash2, Unlink, X, UserRound } from "lucide-react";

import { ActivityCard, ActivityComposer } from "@/components/activity/activity-components";
import { ConfirmAction } from "@/components/common/confirm-action";
import { Detail, PersonField, SectionTitle } from "@/components/common/detail";
import { StatusBadge } from "@/components/common/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Company, fullName, Person, TimelineItem, Todo } from "@/lib/api";
import { firstUsefulLine, initials, relativeDate, searchable } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PersonSheet({
  person,
  onOpenChange,
  companies,
  allCompanies,
  tasks,
  timeline,
  onSavePerson,
  onDeletePerson,
  onLinkCompany,
  onCreateAndLinkCompany,
  onUnlinkCompany,
  onActivityCreated,
  onCreateTask,
  onToggleTask,
}: {
  person: Person | null;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  allCompanies: Company[];
  tasks: Todo[];
  timeline: TimelineItem[];
  onSavePerson: (person: Person) => Promise<Person>;
  onDeletePerson: (person: Person) => Promise<void>;
  onLinkCompany: (companyId: string, role: string) => Promise<void>;
  onCreateAndLinkCompany: (company: { name: string; domain: string; role: string }) => Promise<void>;
  onUnlinkCompany: (companyId: string) => Promise<void>;
  onActivityCreated: () => void;
  onCreateTask: (input: { title: string; body: string; due_at?: string }) => Promise<void>;
  onToggleTask: (task: Todo) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string>("");
  const editing = Boolean(person && editingId === person.id);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Person>>({});
  const [companyBusy, setCompanyBusy] = useState(false);
  const [companyCreateOpen, setCompanyCreateOpen] = useState(false);
  const [companyDraft, setCompanyDraft] = useState({ name: "", domain: "", role: "" });
  const [companyQuery, setCompanyQuery] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companyRole, setCompanyRole] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskBody, setTaskBody] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskComposerOpen, setTaskComposerOpen] = useState(false);
  const draft = person ? drafts[person.id] ?? person : null;
  const setDraft = (next: Person) => {
    setDrafts((current) => ({ ...current, [next.id]: next }));
  };
  const linkedCompanyIds = new Set(companies.map((company) => company.id));
  const companyOptions = allCompanies
    .filter((company) => !linkedCompanyIds.has(company.id))
    .filter((company) => !companyQuery || searchable([company.name, company.domain], companyQuery))
    .slice(0, 30);

  async function linkExistingCompany() {
    if (!person || !selectedCompanyId) return;
    setCompanyBusy(true);
    try {
      await onLinkCompany(selectedCompanyId, companyRole);
      setSelectedCompanyId("");
      setCompanyRole("");
      setCompanyQuery("");
    } finally {
      setCompanyBusy(false);
    }
  }

  async function createAndLinkCompany() {
    if (!person || !companyDraft.name.trim()) return;
    setCompanyBusy(true);
    try {
      await onCreateAndLinkCompany({ name: companyDraft.name.trim(), domain: companyDraft.domain.trim(), role: companyDraft.role.trim() });
      setCompanyDraft({ name: "", domain: "", role: "" });
      setCompanyCreateOpen(false);
    } finally {
      setCompanyBusy(false);
    }
  }

  async function unlinkCompany(companyId: string) {
    if (!person) return;
    setCompanyBusy(true);
    try {
      await onUnlinkCompany(companyId);
    } finally {
      setCompanyBusy(false);
    }
  }

  async function toggleMyTurn() {
    if (!person) return;
    await onSavePerson({ ...person, my_turn: !person.my_turn });
  }

  async function toggleStatus() {
    if (!person) return;
    const nextStatus = (person.status || "active").toLowerCase() === "active" ? "inactive" : "active";
    await onSavePerson({ ...person, status: nextStatus });
  }

  async function deletePerson() {
    if (!person) return;
    await onDeletePerson(person);
  }

  async function completeTask(task: Todo) {
    await onToggleTask(task);
  }

  async function createTask() {
    if (!person || (!taskTitle.trim() && !taskBody.trim())) return;
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

  const relatedTasks = person ? tasks.filter((task) => task.entity_type === "person" && task.entity_id === person.id) : [];
  const notes = timeline.filter((item) => item.type === "note" || item.kind === "activity");

  return (
    <Sheet open={Boolean(person)} onOpenChange={onOpenChange}>
      <SheetContent className="!w-[min(100vw,820px)] !max-w-none overflow-hidden p-0">
        {person && draft && (
          <div className="flex h-full flex-col bg-[oklch(0.985_0.004_255)]">
            <SheetHeader className="border-b py-6 pl-6 pr-16 text-left">
              <div className="flex items-start gap-4">
                <Avatar className="size-12 rounded-2xl border bg-muted">
                  <AvatarFallback className="rounded-2xl font-medium">{initials(fullName(person))}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-xl tracking-[-0.025em]">{fullName(person)}</SheetTitle>
                  <SheetDescription className="mt-1 flex items-center gap-2">
                    <Mail className="size-3.5" /> {person.email || "No email"}
                  </SheetDescription>
                </div>
                <div className="flex shrink-0 gap-2">
                  {editing ? (
                    <>
                      <Button variant="outline" size="sm" className="h-9 rounded-xl bg-background" disabled={saving} onClick={() => { setDraft(person); setEditingId(""); }}><X className="size-3.5" /> Cancel</Button>
                      <Button size="sm" className="h-9 rounded-xl" disabled={saving} onClick={async () => {
                        if (!draft) return;
                        setSaving(true);
                        try {
                          await onSavePerson(draft);
                          setEditingId("");
                        } finally {
                          setSaving(false);
                        }
                      }}><Save className="size-3.5" /> {saving ? "Saving..." : "Save"}</Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" className="h-9 rounded-xl bg-background" onClick={() => { setDraft(person); setEditingId(person.id); }}><Pencil className="size-3.5" /> Edit</Button>
                  )}
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 px-6 py-6">
                <section>
                  <SectionTitle icon={<UserRound className="size-4" />} title="Person" />
                  {editing ? (
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <PersonField label="First name" value={draft.first_name} onChange={(value) => setDraft({ ...draft, first_name: value })} />
                      <PersonField label="Last name" value={draft.last_name} onChange={(value) => setDraft({ ...draft, last_name: value })} />
                      <PersonField label="Email" value={draft.email} onChange={(value) => setDraft({ ...draft, email: value })} />
                      <PersonField label="Phone" value={draft.phone} onChange={(value) => setDraft({ ...draft, phone: value })} />
                      <PersonField label="Role" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} />
                      <PersonField label="City" value={draft.city} onChange={(value) => setDraft({ ...draft, city: value })} />
                      <PersonField label="LinkedIn" value={draft.linkedin_url} onChange={(value) => setDraft({ ...draft, linkedin_url: value })} />
                      <PersonField label="Source" value={draft.source} onChange={(value) => setDraft({ ...draft, source: value })} />
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      <Detail label="Role" value={person.title || "No title"} />
                      <Detail label="City" value={person.city || "No city"} />
                      <Detail label="Phone" value={person.phone || "No phone"} />
                      <Detail label="LinkedIn" value={person.linkedin_url || "No LinkedIn"} />
                      <Detail label="Source" value={person.source || "No source"} />
                      <Detail label="Last touch" value={relativeDate(person.last_touch_at)} />
                    </div>
                  )}
                  {!editing && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" onClick={toggleStatus}><Ban className="size-3.5" /> {(person.status || "active").toLowerCase() === "active" ? "Mark inactive" : "Mark active"}</Button>
                      <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" onClick={toggleMyTurn}><Flag className="size-3.5" /> {person.my_turn ? "Clear attention flag" : "Flag for my attention"}</Button>
                      <ConfirmAction
                        title={`Delete ${fullName(person)}?`}
                        description="This removes the person and their CRM relationships. This action cannot be undone."
                        actionLabel="Delete person"
                        onConfirm={deletePerson}
                        trigger={<Button size="sm" variant="outline" className="h-8 rounded-xl bg-background text-destructive"><Trash2 className="size-3.5" /> Delete</Button>}
                      />
                    </div>
                  )}
                </section>

                <Separator />

                <section>
                  <div className="flex items-center justify-between gap-3">
                    <SectionTitle icon={<Building2 className="size-4" />} title="Companies" />
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background"><LinkIcon className="size-3.5" /> Link existing</Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" side="left" collisionPadding={16} className="max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[360px] overflow-hidden rounded-2xl p-0">
                          <div className="flex max-h-[calc(100vh-2rem)] min-h-0 flex-col">
                            <div className="space-y-3 p-3 pb-2">
                              <div>
                                <div className="text-sm font-medium">Link company</div>
                                <p className="text-xs text-muted-foreground">Attach this person to an existing company.</p>
                              </div>
                              <Input value={companyQuery} onChange={(event) => setCompanyQuery(event.target.value)} placeholder="Search companies" className="h-9 rounded-xl" />
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto px-3">
                              <div className="space-y-1 pr-1">
                                {companyOptions.map((company) => (
                                  <button key={company.id} type="button" className={cn("w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted", selectedCompanyId === company.id && "bg-muted")} onClick={() => setSelectedCompanyId(company.id)}>
                                    <span className="block font-medium">{company.name || "Unnamed company"}</span>
                                    {company.domain && <span className="block truncate text-xs text-muted-foreground">{company.domain}</span>}
                                  </button>
                                ))}
                                {!companyOptions.length && <p className="px-3 py-4 text-sm text-muted-foreground">No companies found.</p>}
                              </div>
                            </div>
                            <div className="space-y-2 border-t bg-popover p-3">
                              <Input value={companyRole} onChange={(event) => setCompanyRole(event.target.value)} placeholder="Role at company, optional" className="h-9 rounded-xl" />
                              <Button size="sm" className="h-9 w-full rounded-xl" disabled={companyBusy || !selectedCompanyId} onClick={linkExistingCompany}><LinkIcon className="size-3.5" /> Link company</Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" onClick={() => setCompanyCreateOpen((open) => !open)}><Plus className="size-3.5" /> Create</Button>
                    </div>
                  </div>

                  {companyCreateOpen && (
                    <div className="mt-3 grid gap-3 rounded-2xl border bg-muted/30 p-3 sm:grid-cols-3">
                      <Input value={companyDraft.name} onChange={(event) => setCompanyDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Company name" className="h-9 rounded-xl bg-background" />
                      <Input value={companyDraft.domain} onChange={(event) => setCompanyDraft((current) => ({ ...current, domain: event.target.value }))} placeholder="Domain" className="h-9 rounded-xl bg-background" />
                      <div className="flex gap-2">
                        <Input value={companyDraft.role} onChange={(event) => setCompanyDraft((current) => ({ ...current, role: event.target.value }))} placeholder="Role at company" className="h-9 rounded-xl bg-background" />
                        <Button size="sm" className="h-9 rounded-xl" disabled={companyBusy || !companyDraft.name.trim()} onClick={createAndLinkCompany}><Plus className="size-3.5" /> Add</Button>
                      </div>
                    </div>
                  )}

                  {companies.length ? (
                    <div className="mt-3 divide-y border-y">
                      {companies.map((company) => (
                        <div key={company.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{company.name}</div>
                            <div className="mt-0.5 truncate text-sm text-muted-foreground">{company.domain || "No domain"}</div>
                          </div>
                          <ConfirmAction
                            title={`Remove ${company.name || "this company"} from ${fullName(person)}?`}
                            description="This only unlinks the relationship. The person and company records stay in CRMe."
                            actionLabel="Unlink company"
                            onConfirm={() => unlinkCompany(company.id)}
                            trigger={<Button size="sm" variant="ghost" className="h-8 rounded-xl text-muted-foreground" disabled={companyBusy}><Unlink className="size-3.5" /> Remove</Button>}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">No company linked to this person.</p>
                  )}
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
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusBadge value={task.status} tone={task.status === "done" ? "green" : "amber"} />
                          <Button size="sm" variant="ghost" className="h-8 rounded-xl text-muted-foreground" disabled={taskBusy} onClick={() => completeTask(task)}>{task.status === "done" ? <RotateCcw className="size-3.5" /> : <CheckCircle2 className="size-3.5" />} {task.status === "done" ? "Reopen" : "Complete"}</Button>
                        </div>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No tasks linked to this person.</p>}
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
                    <ActivityComposer entityType="person" entityId={person.id} onCreated={onActivityCreated} />
                  </div>
                  <div className="mt-3 space-y-2">
                    {notes.length ? notes.map((note) => (
                      <ActivityCard key={note.id} item={note} onSaved={onActivityCreated} />
                    )) : <p className="text-sm text-muted-foreground">No activities linked to this person.</p>}
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


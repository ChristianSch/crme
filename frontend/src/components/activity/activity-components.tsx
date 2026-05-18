"use client";

import { useState } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";

import { ConfirmAction } from "@/components/common/confirm-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ActivityType, api, TimelineItem } from "@/lib/api";
import { combineLocalDateTime, dateValue, timeValue } from "@/lib/datetime";
import { firstUsefulLine, relativeDate } from "@/lib/format";

export function ActivityCard({ item, onSaved }: { item: TimelineItem; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<ActivityType>(item.type || "note");
  const [body, setBody] = useState(item.body || item.title || "");
  const [date, setDate] = useState(() => dateValue(item.at));
  const [time, setTime] = useState(() => timeValue(item.at));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      if (type === "note") {
        await api.updateNote({ id: item.id, body, occurred_at: combineLocalDateTime(date, time).toISOString() });
      } else {
        await api.updateActivity({ id: item.id, type, body, occurred_at: combineLocalDateTime(date, time).toISOString() });
      }
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      if (item.type === "note") {
        await api.deleteNote(item.id);
      } else {
        await api.deleteActivity(item.id);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-background p-4">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <button type="button" className="block min-w-0 max-w-full overflow-hidden text-left" onClick={() => setOpen((value) => !value)}>
          <div className="block min-w-0 max-w-full truncate text-xs capitalize text-muted-foreground">{item.type || "activity"} · {relativeDate(item.at)}</div>
          <div className="block min-w-0 max-w-full truncate text-sm font-medium">{firstUsefulLine(item.body || item.title || "Empty activity")}</div>
        </button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" onClick={() => { setOpen(true); setEditing((value) => !value); }}><Pencil className="size-3.5" /> Edit</Button>
          <ConfirmAction
            title={`Delete this ${item.type === "note" ? "note" : "activity"}?`}
            description="This removes the timeline entry from this record. This action cannot be undone."
            actionLabel="Delete"
            onConfirm={remove}
            trigger={<Button size="sm" variant="outline" className="h-8 rounded-xl bg-background text-destructive" disabled={saving}><Trash2 className="size-3.5" /> Delete</Button>}
          />
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          {editing ? (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <Select value={type} onValueChange={(value) => setType(value as ActivityType)}>
                  <SelectTrigger className="h-9 rounded-xl bg-background shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent align="start" position="popper" className="rounded-xl p-1">
                    <SelectItem value="call" className="rounded-lg py-2 pl-3 pr-8">Call</SelectItem>
                    <SelectItem value="meeting" className="rounded-lg py-2 pl-3 pr-8">Meeting</SelectItem>
                    <SelectItem value="note" className="rounded-lg py-2 pl-3 pr-8">Note</SelectItem>
                    <SelectItem value="email" className="rounded-lg py-2 pl-3 pr-8">Email</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-9 rounded-xl bg-background" />
                <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="h-9 rounded-xl bg-background" />
              </div>
              <Textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-28 rounded-xl bg-background" />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" disabled={saving} onClick={() => setEditing(false)}><X className="size-3.5" /> Cancel</Button>
                <Button size="sm" className="h-8 rounded-xl" disabled={saving || !body.trim()} onClick={save}><Save className="size-3.5" /> {saving ? "Saving..." : "Save"}</Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="max-w-[58ch] whitespace-pre-wrap break-words text-sm leading-6">{item.private_body || item.body || item.title || "Empty activity"}</p>
              {item.private_detail && (
                <p className="max-w-[58ch] rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {item.private_detail_own ? "Only you can see the full email details above. Teammates see a sanitized activity." : "Email details are private to the mailbox owner. You can see the shared activity summary."}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ActivityComposer({ entityType, entityId, onCreated }: { entityType: "person" | "company" | "deal"; entityId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ActivityType>("call");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(() => dateValue(new Date().toISOString()));
  const [time, setTime] = useState(() => timeValue(new Date().toISOString()));
  const [saving, setSaving] = useState(false);

  async function saveActivity() {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await api.createActivity({
        type,
        body: body.trim(),
        occurred_at: combineLocalDateTime(date, time).toISOString(),
        entity_type: entityType,
        entity_id: entityId,
      });
      setBody("");
      setType("call");
      setDate(dateValue(new Date().toISOString()));
      setTime(timeValue(new Date().toISOString()));
      setOpen(false);
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background"><Plus className="size-3.5" /> Add activity</Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={16} className="max-h-[min(520px,calc(100vh-2rem))] w-[min(calc(100vw-2rem),380px)] overflow-y-auto rounded-2xl p-3">
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium">Add activity</div>
            <p className="text-xs text-muted-foreground">Log a call, meeting, or note without needing an email.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={type} onValueChange={(value) => setType(value as ActivityType)}>
              <SelectTrigger className="h-9 rounded-xl bg-background shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" position="popper" className="rounded-xl p-1">
                <SelectItem value="call" className="rounded-lg py-2 pl-3 pr-8">Call</SelectItem>
                <SelectItem value="meeting" className="rounded-lg py-2 pl-3 pr-8">Meeting</SelectItem>
                <SelectItem value="note" className="rounded-lg py-2 pl-3 pr-8">Note</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-9 rounded-xl bg-background" />
            <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="h-9 rounded-xl bg-background" />
          </div>
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="What happened?" className="min-h-28 rounded-xl bg-background" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" className="h-9 rounded-xl bg-background" disabled={saving} onClick={() => setOpen(false)}><X className="size-3.5" /> Cancel</Button>
            <Button size="sm" className="h-9 rounded-xl" disabled={saving || !body.trim()} onClick={saveActivity}><Save className="size-3.5" /> {saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}


"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Building2, CalendarClock, Circle, Command, LayoutDashboard, Lightbulb, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, Company, Deal, fullName, GlobalSearchResults, Person, Todo } from "@/lib/api";
import { formatMoney, relativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CreateRecordType = "person" | "company" | "deal" | "task";

type CommandAction = {
  id: string;
  group: "Create" | "Go to";
  label: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  run: () => void;
};

type SearchItem = {
  id: string;
  group: "People" | "Companies" | "Deals" | "Tasks";
  label: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  run: () => void;
};

type PaletteItem = CommandAction | SearchItem;

const emptyResults: GlobalSearchResults = { people: [], companies: [], deals: [], tasks: [] };

export function shortcutLabel() {
  if (typeof navigator === "undefined") return "⌘K";
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "⌘K" : "Ctrl K";
}

export function CommandPalette({
  workspaceId,
  onSelectPerson,
  onSelectCompany,
  onSelectDeal,
  onSelectTask,
  onCreate,
}: {
  workspaceId: string;
  onSelectPerson: (person: Person) => void;
  onSelectCompany: (company: Company) => void;
  onSelectDeal: (deal: Deal) => void;
  onSelectTask: (task: Todo) => void;
  onCreate: (type: CreateRecordType) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults>(emptyResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [hint] = useState(shortcutLabel);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.isComposing) return;
      const isK = event.key.toLowerCase() === "k" || event.code === "KeyK";
      const hasCommandModifier = event.metaKey || event.ctrlKey;
      if (!isK || !hasCommandModifier) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen((value) => !value);
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) return;

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const next = await api.globalSearch(trimmed, workspaceId === "all" ? "" : workspaceId);
        if (!cancelled) setResults(next);
      } catch {
        if (!cancelled) setError("Could not search CRM. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, query, workspaceId]);

  const commandItems = useMemo<CommandAction[]>(() => [
    { id: "create-person", group: "Create", label: "New person", detail: "Create a contact record", icon: UserRound, run: () => onCreate("person") },
    { id: "create-company", group: "Create", label: "New company", detail: "Create an account record", icon: Building2, run: () => onCreate("company") },
    { id: "create-task", group: "Create", label: "New task", detail: "Create follow-up work", icon: CalendarClock, run: () => onCreate("task") },
    { id: "create-deal", group: "Create", label: "New deal", detail: "Create a pipeline record", icon: Circle, run: () => onCreate("deal") },
    { id: "go-dashboard", group: "Go to", label: "Dashboard", detail: "Open work and prompts", icon: LayoutDashboard, run: () => router.push("/") },
    { id: "go-people", group: "Go to", label: "People", detail: "Browse contacts", icon: UserRound, run: () => router.push("/people") },
    { id: "go-companies", group: "Go to", label: "Companies", detail: "Browse accounts", icon: Building2, run: () => router.push("/companies") },
    { id: "go-deals", group: "Go to", label: "Deals", detail: "Browse pipeline", icon: Circle, run: () => router.push("/deals") },
    { id: "go-tasks", group: "Go to", label: "Tasks", detail: "Browse open work", icon: CalendarClock, run: () => router.push("/tasks") },
    { id: "go-suggestions", group: "Go to", label: "Suggestions", detail: "Review CRM prompts", icon: Lightbulb, run: () => router.push("/suggestions") },
  ], [onCreate, router]);

  const searchItems = useMemo<SearchItem[]>(() => [
    ...(results.people ?? []).map((person) => ({ id: `person-${person.id}`, group: "People" as const, label: fullName(person) || "Unnamed person", detail: [person.email, person.title].filter(Boolean).join(" · ") || "No email", icon: UserRound, run: () => onSelectPerson(person) })),
    ...(results.companies ?? []).map((company) => ({ id: `company-${company.id}`, group: "Companies" as const, label: company.name || company.domain || "Unnamed company", detail: company.domain || "No domain", icon: Building2, run: () => onSelectCompany(company) })),
    ...(results.deals ?? []).map((deal) => ({ id: `deal-${deal.id}`, group: "Deals" as const, label: deal.name || "Unnamed deal", detail: `${formatMoney(deal.value_cents, deal.currency)} · ${deal.stage || "No stage"}`, icon: Circle, run: () => onSelectDeal(deal) })),
    ...(results.tasks ?? []).map((task) => ({ id: `task-${task.id}`, group: "Tasks" as const, label: task.title || task.body || "Untitled task", detail: `${task.status} · Due ${relativeDate(task.due_at)}`, icon: CalendarClock, run: () => onSelectTask(task) })),
  ], [onSelectCompany, onSelectDeal, onSelectPerson, onSelectTask, results]);

  const matchingCommandItems = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return commandItems;
    return commandItems.filter((item) => [item.label, item.detail, item.group].some((value) => value.toLowerCase().includes(trimmed)));
  }, [commandItems, query]);

  const items: PaletteItem[] = query.trim() ? [...matchingCommandItems, ...searchItems] : commandItems;
  const groupedItems = groupItems(items);

  function runItem(item: PaletteItem) {
    item.run();
    setOpen(false);
    setQuery("");
  }

  function onPaletteKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(items.length - 1, 0)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === "Enter" && items[activeIndex]) {
      event.preventDefault();
      runItem(items[activeIndex]);
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" className="h-9 gap-2 rounded-xl px-3 text-foreground" onClick={() => setOpen(true)}>
        <Command className="size-4 text-muted-foreground" />
        <span>Command menu</span>
        <kbd className="ml-1 rounded-md border bg-background px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground">{hint}</kbd>
      </Button>
      {open && (
        <div className="fixed inset-0 z-[1000]" role="presentation">
          <button type="button" aria-label="Close command palette" className="absolute inset-0 cursor-default bg-[oklch(0.22_0.018_38_/_0.18)] backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div role="dialog" aria-modal="true" aria-labelledby="command-palette-title" aria-describedby="command-palette-description" className="fixed left-1/2 top-1/2 z-[1001] flex max-h-[min(680px,76vh)] w-[min(calc(100vw-1.5rem),680px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-popover shadow-[0_24px_80px_oklch(0.45_0.01_255_/_0.24)] outline-none">
            <h2 id="command-palette-title" className="sr-only">Command palette</h2>
            <p id="command-palette-description" className="sr-only">Search records or run a CRM command.</p>
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <Command className="size-4 text-muted-foreground" />
              <Input ref={inputRef} value={query} onChange={(event) => { const value = event.target.value; setQuery(value); setActiveIndex(0); if (value.trim()) { setLoading(true); setError(""); } else { setResults(emptyResults); setLoading(false); setError(""); } }} onKeyDown={onPaletteKeyDown} aria-label="Search records or run a command" placeholder="Search records or run a command" className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
              <kbd className="hidden rounded-md border bg-muted px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground sm:block">Esc</kbd>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {loading && <StatusRow label="Searching CRM..." />}
              {error && <StatusRow label={error} tone="error" />}
              {!loading && !error && query.trim() && !items.length && (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm font-medium">No matching records</p>
                  <p className="mt-1 text-sm text-muted-foreground">Create a new record instead.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {commandItems.filter((item) => item.group === "Create").map((item) => {
                      const Icon = item.icon;
                      return <Button key={item.id} size="sm" variant="outline" className="h-8 rounded-xl bg-background" onClick={() => runItem(item)}><Icon className="size-3.5" /> {item.label}</Button>;
                    })}
                  </div>
                </div>
              )}
              {!error && Boolean(groupedItems.length) && groupedItems.map(([group, groupItems]) => (
                <div key={group} className="py-2">
                  <div className="px-3 pb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{group}</div>
                  <div className="space-y-1">
                    {groupItems.map((item) => {
                      const index = items.findIndex((candidate) => candidate.id === item.id);
                      const Icon = item.icon;
                      return (
                        <button key={item.id} type="button" className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors", index === activeIndex ? "bg-muted text-foreground" : "hover:bg-muted/70")} onMouseEnter={() => setActiveIndex(index)} onClick={() => runItem(item)}>
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-background text-muted-foreground"><Icon className="size-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{item.label}</span>
                            <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatusRow({ label, tone = "muted" }: { label: string; tone?: "muted" | "error" }) {
  return <div className={cn("px-3 py-6 text-center text-sm", tone === "error" ? "text-destructive" : "text-muted-foreground")}>{label}</div>;
}

function groupItems(items: PaletteItem[]) {
  const groups: Array<[PaletteItem["group"], PaletteItem[]]> = [];
  for (const item of items) {
    const current = groups.find(([group]) => group === item.group);
    if (current) current[1].push(item);
    else groups.push([item.group, [item]]);
  }
  return groups;
}

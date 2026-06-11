"use client";

import { EmptyState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Suggestion } from "@/lib/api";
import { compareDates, relativeDate } from "@/lib/format";

export function DashboardSuggestionGroups({ suggestions, onOpenSuggestions }: { suggestions: Suggestion[]; onOpenSuggestions: () => void }) {
  const openSuggestions = suggestions.filter((suggestion) => suggestion.status === "open");
  const suggestionGroups = groupSuggestions(openSuggestions);

  return (
    <aside className="min-w-0 overflow-hidden rounded-xl border bg-background">
      <div className="flex items-center justify-between gap-3 border-b bg-[oklch(0.965_0.008_255)] px-5 py-4">
        <div><h2 className="text-base font-semibold tracking-[-0.02em]">Recommendations</h2><p className="mt-1 text-xs text-muted-foreground">Suggested updates and follow-ups.</p></div>
        <Button variant="outline" className="h-8 rounded-xl bg-background px-3 text-xs" onClick={onOpenSuggestions}>All suggestions</Button>
      </div>
      {suggestionGroups.length ? <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">{suggestionGroups.map((group) => <button key={group.kind} type="button" className="block min-w-0 px-5 py-4 text-left transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring" onClick={onOpenSuggestions}><div className="flex items-baseline justify-between gap-3"><div className="text-sm font-medium tracking-[-0.01em]">{group.label}</div><div className="text-lg font-semibold tabular-nums tracking-[-0.035em]">{group.count}</div></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{group.description}</p><div className="mt-3 text-xs text-muted-foreground">Latest {relativeDate(group.latestAt)}</div></button>)}</div> : <EmptyState title="No recommendations waiting" body="Future enrichment prompts, like missing email or stale follow-up, will appear here." />}
    </aside>
  );
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

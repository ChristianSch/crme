"use client";

import { useState } from "react";
import { Check, LinkIcon, MoreHorizontal, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmAction } from "@/components/common/confirm-action";
import { EmptyState } from "@/components/common/data-state";
import { StatusBadge } from "@/components/common/status-badge";
import { api, Company, fullName, Person, Suggestion } from "@/lib/api";
import { relativeDate, searchable } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SuggestionUndo = {
  label: string;
  suggestionId: string;
  createdEntityType?: "person" | "company";
  createdEntityId?: string;
};

export function readStoredSuggestionUndo() {
  const raw = window.localStorage.getItem("crme:last_suggestion_undo");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SuggestionUndo;
  } catch {
    return null;
  }
}

function storeSuggestionUndo(undo: SuggestionUndo) {
  window.localStorage.setItem("crme:last_suggestion_undo", JSON.stringify(undo));
}

export function clearStoredSuggestionUndo() {
  window.localStorage.removeItem("crme:last_suggestion_undo");
}

export function SuggestionsPanel({
  suggestions,
  people,
  companies,
  onChanged,
  onUndo,
}: {
  suggestions: Suggestion[];
  people: Person[];
  companies: Company[];
  onChanged: () => void;
  onUndo: (undo: SuggestionUndo | null) => void;
}) {
  const [busyId, setBusyId] = useState<string>("");
  const [selectedPeople, setSelectedPeople] = useState<Record<string, string>>({});
  const [selectedCompanies, setSelectedCompanies] = useState<Record<string, string>>({});

  async function act(suggestion: Suggestion, action: "accept" | "dismiss" | "suppress") {
    setBusyId(suggestion.id);
    try {
      const result = action === "accept" ? await api.acceptSuggestion(suggestion.id) : null;
      if (action === "suppress") {
        await api.suppressSuggestion(suggestion.id);
      } else if (action === "dismiss") {
        await api.dismissSuggestion(suggestion.id);
      }
      const undo: SuggestionUndo = {
        label: `${action === "accept" ? "Approved" : action === "suppress" ? "Suppressed" : "Dismissed"} suggestion`,
        suggestionId: suggestion.id,
        createdEntityType: result?.created ? result.created_entity_type : undefined,
        createdEntityId: result?.created ? result.created_entity_id : undefined,
      };
      storeSuggestionUndo(undo);
      onUndo(undo);
      await onChanged();
    } finally {
      setBusyId("");
    }
  }

  async function linkToExistingPerson(suggestion: Suggestion) {
    const personId = selectedPeople[suggestion.id] || suggestedPeopleForSuggestion(suggestion, people)[0]?.id;
    if (!personId) return;
    setBusyId(suggestion.id);
    try {
      await api.linkSuggestionPerson(suggestion.id, personId);
      onUndo({ label: "Linked suggestion to existing person", suggestionId: suggestion.id });
      await onChanged();
    } finally {
      setBusyId("");
    }
  }

  async function linkToExistingCompany(suggestion: Suggestion) {
    const companyId = selectedCompanies[suggestion.id] || suggestedCompaniesForSuggestion(suggestion, companies)[0]?.id;
    if (!companyId) return;
    setBusyId(suggestion.id);
    try {
      await api.linkSuggestionCompany(suggestion.id, companyId);
      onUndo({ label: "Linked suggestion to existing company", suggestionId: suggestion.id });
      await onChanged();
    } finally {
      setBusyId("");
    }
  }

  if (!suggestions.length) return <EmptyState title="No open suggestions" body="Agent prompts and detected records will appear here when there is something to review." />;

  return (
    <div className="bg-background p-4 sm:p-5 lg:p-6">
      <div className="mb-5 rounded-2xl border border-border bg-[oklch(0.974_0.006_255)] p-4">
        <div className="flex items-center gap-2 font-medium tracking-[-0.02em]"><Sparkles className="size-4" /> Agent note</div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">These are prepared changes. Review each suggestion, link it to an existing record when needed, then approve only what should become part of your crm.</p>
      </div>
      <div className="space-y-3">
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-[0_12px_34px_oklch(0.45_0.012_255_/_0.10)] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <StatusBadge value={suggestion.kind.replaceAll("_", " ")} tone="blue" />
                  <span className="text-xs text-muted-foreground">Ready for review</span>
                  <span className="text-xs text-muted-foreground">Last touch {relativeDate(suggestion.last_touch_at ?? suggestion.created_at)}</span>
                </div>
                <h3 className="text-base font-medium tracking-[-0.02em]">{suggestion.title}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{suggestionCardBody(suggestion)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                {suggestion.kind === "new_contact" && (
                  <LinkPersonPopover
                    suggestion={suggestion}
                    people={people}
                    value={selectedPeople[suggestion.id] || suggestedPeopleForSuggestion(suggestion, people)[0]?.id || ""}
                    onChange={(personId) => setSelectedPeople((current) => ({ ...current, [suggestion.id]: personId }))}
                    onLink={() => linkToExistingPerson(suggestion)}
                    disabled={busyId === suggestion.id}
                  />
                )}
                {suggestion.kind === "new_company" && (
                  <LinkCompanyPopover
                    suggestion={suggestion}
                    companies={companies}
                    value={selectedCompanies[suggestion.id] || suggestedCompaniesForSuggestion(suggestion, companies)[0]?.id || ""}
                    onChange={(companyId) => setSelectedCompanies((current) => ({ ...current, [suggestion.id]: companyId }))}
                    onLink={() => linkToExistingCompany(suggestion)}
                    disabled={busyId === suggestion.id}
                  />
                )}
                <Button size="sm" className="h-8 rounded-xl" disabled={busyId === suggestion.id} onClick={() => act(suggestion, "accept")}><Check className="size-3.5" /> {suggestion.kind === "new_contact" ? "Create contact" : suggestion.kind === "new_company" ? "Create company" : "Approve"}</Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon-sm" variant="outline" className="h-8 w-8 rounded-xl bg-background" disabled={busyId === suggestion.id} aria-label="Suggestion actions"><MoreHorizontal className="size-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-xl">
                    <DropdownMenuItem onClick={() => act(suggestion, "dismiss")}>Dismiss for now</DropdownMenuItem>
                    <ConfirmAction
                      title="Never ask again?"
                      description="This suppresses future suggestions like this. Use it only when this prompt is not useful for your CRM."
                      actionLabel="Never ask again"
                      onConfirm={() => act(suggestion, "suppress")}
                      trigger={<DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>Never ask again</DropdownMenuItem>}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinkPersonPopover({
  suggestion,
  people,
  value,
  onChange,
  onLink,
  disabled,
}: {
  suggestion: Suggestion;
  people: Person[];
  value: string;
  onChange: (personId: string) => void;
  onLink: () => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const matches = suggestedPeopleForSuggestion(suggestion, people);
  const options = (query ? people.filter((person) => searchable([fullName(person), person.email], query)) : matches).slice(0, 30);
  const selected = people.find((person) => person.id === value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" disabled={disabled}><LinkIcon className="size-3.5" /> Link existing</Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={16} className="flex h-[min(420px,calc(100vh-2rem))] w-[min(calc(100vw-2rem),340px)] flex-col overflow-hidden rounded-2xl p-3">
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div>
            <div className="text-sm font-medium">Link to existing person</div>
            <p className="text-xs text-muted-foreground">Choose who should receive this email address.</p>
          </div>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search people" placeholder="Search people" className="h-9 rounded-xl" />
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-1">
              {options.map((person) => (
                <button key={person.id} type="button" className={cn("w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted", value === person.id && "bg-muted")} onClick={() => onChange(person.id)}>
                  <span className="block font-medium">{fullName(person)}</span>
                  {person.email && <span className="block truncate text-xs text-muted-foreground">{person.email}</span>}
                </button>
              ))}
              {!options.length && <p className="px-3 py-4 text-sm text-muted-foreground">{query ? "No matching people." : "No likely existing person match found. Search to choose manually."}</p>}
            </div>
          </div>
          <Button size="sm" className="h-9 w-full shrink-0 rounded-xl" disabled={disabled || !value} onClick={onLink}>Link{selected ? ` to ${fullName(selected)}` : " selected"}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LinkCompanyPopover({
  suggestion,
  companies,
  value,
  onChange,
  onLink,
  disabled,
}: {
  suggestion: Suggestion;
  companies: Company[];
  value: string;
  onChange: (companyId: string) => void;
  onLink: () => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const matches = suggestedCompaniesForSuggestion(suggestion, companies);
  const options = (query ? companies.filter((company) => searchable([company.name, company.domain], query)) : matches).slice(0, 30);
  const selected = companies.find((company) => company.id === value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background" disabled={disabled}><LinkIcon className="size-3.5" /> Link existing</Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={16} className="flex h-[min(420px,calc(100vh-2rem))] w-[min(calc(100vw-2rem),340px)] flex-col overflow-hidden rounded-2xl p-3">
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div>
            <div className="text-sm font-medium">Link to existing company</div>
            <p className="text-xs text-muted-foreground">Choose which company should receive this domain.</p>
          </div>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search companies" placeholder="Search companies" className="h-9 rounded-xl" />
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-1">
              {options.map((company) => (
                <button key={company.id} type="button" className={cn("w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted", value === company.id && "bg-muted")} onClick={() => onChange(company.id)}>
                  <span className="block font-medium">{company.name}</span>
                  {company.domain && <span className="block truncate text-xs text-muted-foreground">{company.domain}</span>}
                </button>
              ))}
              {!options.length && <p className="px-3 py-4 text-sm text-muted-foreground">{query ? "No matching companies." : "No likely company match found. Search to choose manually."}</p>}
            </div>
          </div>
          <Button size="sm" className="h-9 w-full shrink-0 rounded-xl" disabled={disabled || !value} onClick={onLink}>Link{selected ? ` to ${selected.name}` : " selected"}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function suggestionCardBody(suggestion: Suggestion) {
  const lines = suggestion.body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const source = lines.find((line) => line.toLowerCase().startsWith("inbound email from "));
  const subject = lines.find((line) => line.toLowerCase().startsWith("subject:"));

  if (source || subject) {
    return [source?.replace(/^Inbound email from\s*/i, "From "), subject?.replace(/^Subject:\s*/i, "Subject: ")]
      .filter(Boolean)
      .join(" · ");
  }

  const contextualLines = lines.filter((line) => !/^review\b/i.test(line));
  return contextualLines[0] ?? suggestion.body;
}

function suggestedPeopleForSuggestion(suggestion: Suggestion, people: Person[]) {
  const email = suggestionEmail(suggestion);
  const localPart = email.split("@")[0] ?? "";
  const tokens = normalizeText(localPart).split(" ").filter((token) => token.length > 2);
  if (!tokens.length) return [];

  return people
    .map((person) => ({ person, score: matchScore(tokens.join(" "), [fullName(person), person.email]) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((item) => item.person);
}

function suggestedCompaniesForSuggestion(suggestion: Suggestion, companies: Company[]) {
  const domain = suggestionDomain(suggestion);
  if (!domain) return [];

  return companies
    .map((company) => ({ company, score: matchScore(domain, [company.name, company.domain]) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((item) => item.company);
}

function matchScore(input: string, values: Array<string | undefined>) {
  return values.reduce((score, value) => {
    const tokens = normalizeText(value ?? "").split(" ").filter((token) => token.length > 2);
    return score + tokens.filter((token) => input.includes(token)).length;
  }, 0);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function suggestionEmail(suggestion: Suggestion) {
  const titleMatch = suggestion.title.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (titleMatch) return titleMatch[0].toLowerCase();
  const bodyMatch = suggestion.body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return bodyMatch?.[0].toLowerCase() ?? "";
}

function suggestionDomain(suggestion: Suggestion) {
  if (suggestion.kind === "new_company") {
    return suggestion.title.replace(/^new company:/i, "").trim().toLowerCase();
  }
  const email = suggestionEmail(suggestion);
  return email.includes("@") ? email.split("@").at(-1)?.toLowerCase() ?? "" : "";
}


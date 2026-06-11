"use client";

import { useCallback, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { CrmRouteShell, LoginScreen, OrganizationGate, PagedTable, UndoToast, useLogout, useOrganizationSwitcher, usePersistedSidebar, usePersistedWorkspace } from "@/components/crm/crm-shared";
import { EmptyState, TableSkeleton } from "@/components/common/data-state";
import { SuggestionsPanel, readStoredSuggestionUndo, type SuggestionUndo } from "@/components/suggestions/suggestions-panel";
import { Input } from "@/components/ui/input";
import { useCrmShell } from "@/hooks/use-crm-shell";
import { PAGE_SIZE, usePagedResource } from "@/hooks/use-paged-list";
import { api, Company, Person } from "@/lib/api";
import { searchable } from "@/lib/format";

export function SuggestionsView({ initialSidebarCollapsed = false, initialWorkspaceId = "all" }: { initialSidebarCollapsed?: boolean; initialWorkspaceId?: string }) {
  const shell = useCrmShell();
  const [workspaceId, setWorkspaceId] = usePersistedWorkspace(initialWorkspaceId);
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedSidebar(initialSidebarCollapsed);
  const setOrganizationId = useOrganizationSwitcher(shell.loadShell);
  const logout = useLogout(shell.loadShell);

  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [undo, setUndo] = useState<SuggestionUndo | null>(() => typeof window === "undefined" ? null : readStoredSuggestionUndo());

  const activeWorkspaceId = workspaceId === "all" ? "" : workspaceId;

  const loadSuggestionsPage = useCallback(async (nextPage: number) => {
    const [nextSuggestions, nextPeople, nextCompanies] = await Promise.all([
      api.suggestions("open", PAGE_SIZE, nextPage * PAGE_SIZE),
      api.people("", activeWorkspaceId, PAGE_SIZE, 0),
      api.companies("", activeWorkspaceId, PAGE_SIZE, 0),
    ]);
    return { items: nextSuggestions ?? [], extra: { people: nextPeople ?? [], companies: nextCompanies ?? [] } };
  }, [activeWorkspaceId]);
  const updateLookups = useCallback((result: { extra?: { people: Person[]; companies: Company[] } }) => {
    setPeople(result.extra?.people ?? []);
    setCompanies(result.extra?.companies ?? []);
  }, []);
  const { items: suggestions, page, hasNext, loading, loadError, load: loadSuggestions } = usePagedResource({
    enabled: shell.state === "ready",
    loadPage: loadSuggestionsPage,
    errorMessage: "Could not load suggestions",
    debounceMs: 0,
    onLoaded: updateLookups,
  });

  const filteredSuggestions = useMemo(() => suggestions.filter((suggestion) => searchable([suggestion.title, suggestion.body, suggestion.kind, suggestion.entity_type, suggestion.status], query)), [query, suggestions]);

  if (shell.state === "unauthorized") return <LoginScreen onRetry={shell.loadShell} />;
  if (shell.state === "needs-organization") return <OrganizationGate userEmail={shell.me?.user.email} organizations={shell.organizations} selectedOrganizationId={shell.selectedOrganizationId} onSelect={setOrganizationId} onCreated={(id) => void shell.loadShell(id)} />;

  return (
    <>
      <CrmRouteShell
        title="Suggestions"
        description="Review proposed CRM updates and approve the useful ones."
        organizations={shell.organizations}
        selectedOrganizationId={shell.selectedOrganizationId}
        workspaces={shell.workspaces}
        workspaceId={workspaceId}
        sidebarCollapsed={sidebarCollapsed}
        onOrganizationChange={setOrganizationId}
        onWorkspaceChange={setWorkspaceId}
        onSidebarCollapsedChange={setSidebarCollapsed}
        onLogout={logout}
        controls={shell.state === "ready" ? (
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full md:max-w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search suggestions" placeholder="Search suggestions" className="h-9 rounded-xl bg-background pl-9 pr-9 shadow-none" />
              {query && <button type="button" aria-label="Clear search" className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" onClick={() => setQuery("")}><X className="size-3.5" /></button>}
            </div>
          </div>
        ) : undefined}
      >
        <div className="mt-5 min-w-0 overflow-hidden rounded-xl border border-border bg-background">
          {shell.state === "loading" ? <TableSkeleton /> : shell.state === "error" ? <EmptyState title="We’re sorry, something went wrong" body="Please come back later and try again." /> : loadError ? <EmptyState title="Could not load suggestions" body={loadError} /> : (
            <PagedTable page={page} hasNext={hasNext} loading={loading} onPageChange={loadSuggestions}>
              <SuggestionsPanel
                suggestions={filteredSuggestions}
                people={people}
                companies={companies}
                onChanged={() => loadSuggestions(page)}
                onUndo={setUndo}
                onAct={(suggestion, action) => {
                  if (action === "accept") return api.acceptSuggestion(suggestion.id);
                  if (action === "suppress") return api.suppressSuggestion(suggestion.id).then(() => null);
                  return api.dismissSuggestion(suggestion.id).then(() => null);
                }}
                onLinkPerson={async (suggestion, personId) => { await api.linkSuggestionPerson(suggestion.id, personId); }}
                onLinkCompany={async (suggestion, companyId) => { await api.linkSuggestionCompany(suggestion.id, companyId); }}
              />
            </PagedTable>
          )}
        </div>
      </CrmRouteShell>
      {undo && <UndoToast undo={undo} onDone={() => loadSuggestions(page)} onClose={() => setUndo(null)} />}
    </>
  );
}

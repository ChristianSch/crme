"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { CrmRouteShell, LoginScreen, OrganizationGate, PagedTable, UndoToast, useLogout, useOrganizationSwitcher, usePersistedSidebar, usePersistedWorkspace } from "@/components/crm/crm-shared";
import { EmptyState, TableSkeleton } from "@/components/common/data-state";
import { SuggestionsPanel, readStoredSuggestionUndo, type SuggestionUndo } from "@/components/suggestions/suggestions-panel";
import { Input } from "@/components/ui/input";
import { useCrmShell } from "@/hooks/use-crm-shell";
import { PAGE_SIZE } from "@/hooks/use-paged-list";
import { api, Company, Person, Suggestion } from "@/lib/api";
import { searchable } from "@/lib/format";

export function SuggestionsView({ initialSidebarCollapsed = false, initialWorkspaceId = "all" }: { initialSidebarCollapsed?: boolean; initialWorkspaceId?: string }) {
  const shell = useCrmShell();
  const [workspaceId, setWorkspaceId] = usePersistedWorkspace(initialWorkspaceId);
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedSidebar(initialSidebarCollapsed);
  const setOrganizationId = useOrganizationSwitcher(shell.loadShell);
  const logout = useLogout(shell.loadShell);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [undo, setUndo] = useState<SuggestionUndo | null>(() => typeof window === "undefined" ? null : readStoredSuggestionUndo());

  const activeWorkspaceId = workspaceId === "all" ? "" : workspaceId;

  const loadSuggestions = useCallback(async (nextPage = 0) => {
    if (shell.state !== "ready") return;
    setLoading(true);
    setLoadError("");
    try {
      const [nextSuggestions, nextPeople, nextCompanies] = await Promise.all([
        api.suggestions("open", PAGE_SIZE, nextPage * PAGE_SIZE),
        api.people("", activeWorkspaceId, PAGE_SIZE, 0),
        api.companies("", activeWorkspaceId, PAGE_SIZE, 0),
      ]);
      setSuggestions(nextSuggestions ?? []);
      setPeople(nextPeople ?? []);
      setCompanies(nextCompanies ?? []);
      setPage(nextPage);
      setHasNext((nextSuggestions ?? []).length === PAGE_SIZE);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load suggestions");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, shell.state]);

  useEffect(() => {
    if (shell.state !== "ready") return;
    queueMicrotask(() => void loadSuggestions(0));
  }, [loadSuggestions, shell.state]);

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
              <SuggestionsPanel suggestions={filteredSuggestions} people={people} companies={companies} onChanged={() => loadSuggestions(page)} onUndo={setUndo} />
            </PagedTable>
          )}
        </div>
      </CrmRouteShell>
      {undo && <UndoToast undo={undo} onDone={() => loadSuggestions(page)} onClose={() => setUndo(null)} />}
    </>
  );
}

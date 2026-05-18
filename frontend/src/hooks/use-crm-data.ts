"use client";

import { useCallback, useEffect, useState } from "react";

import { api, Company, Deal, Me, OrganizationMembership, Person, setSelectedOrganizationId, storedOrganizationId, Suggestion, Todo, Workspace } from "@/lib/api";

export type LoadState = "loading" | "ready" | "error" | "unauthorized" | "needs-organization";

const PAGE_SIZE = 50;

type PageState = {
  page: number;
  loading: boolean;
  hasNext: boolean;
};

const initialPageState: PageState = { page: 0, loading: false, hasNext: true };

export function useCrmData() {
  const [me, setMe] = useState<Me | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [selectedOrganizationIdState, setSelectedOrganizationIdState] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tasks, setTasks] = useState<Todo[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [peoplePage, setPeoplePage] = useState<PageState>(initialPageState);
  const [companiesPage, setCompaniesPage] = useState<PageState>(initialPageState);
  const [tasksPage, setTasksPage] = useState<PageState>(initialPageState);
  const [dealsPage, setDealsPage] = useState<PageState>(initialPageState);

  const setLoadError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    const lowerMessage = message.toLowerCase();
    setState(lowerMessage.includes("missing session") || lowerMessage.includes("invalid session") ? "unauthorized" : "error");
  }, []);

  const loadPeople = useCallback(async (q = "", workspaceId = "", page = 0) => {
    setPeoplePage((current) => ({ ...current, page, loading: true }));
    try {
      const next = await api.people(q, workspaceId, PAGE_SIZE, page * PAGE_SIZE);
      setPeople(next ?? []);
      setPeoplePage({ page, loading: false, hasNext: next.length === PAGE_SIZE });
    } catch (error) {
      setPeoplePage((current) => ({ ...current, loading: false }));
      setLoadError(error);
    }
  }, [setLoadError]);

  const loadCompanies = useCallback(async (q = "", workspaceId = "", page = 0) => {
    setCompaniesPage((current) => ({ ...current, page, loading: true }));
    try {
      const next = await api.companies(q, workspaceId, PAGE_SIZE, page * PAGE_SIZE);
      setCompanies(next ?? []);
      setCompaniesPage({ page, loading: false, hasNext: next.length === PAGE_SIZE });
    } catch (error) {
      setCompaniesPage((current) => ({ ...current, loading: false }));
      setLoadError(error);
    }
  }, [setLoadError]);

  const loadTasks = useCallback(async (q = "", workspaceId = "", page = 0, status: "open" | "done" | "all" = "all", due: "today" | "overdue" | "upcoming" | "none" | "all" = "all") => {
    setTasksPage((current) => ({ ...current, page, loading: true }));
    try {
      const next = await api.tasks({ q, workspace_id: workspaceId || undefined, status, due, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setTasks(next ?? []);
      setTasksPage({ page, loading: false, hasNext: next.length === PAGE_SIZE });
    } catch (error) {
      setTasksPage((current) => ({ ...current, loading: false }));
      setLoadError(error);
    }
  }, [setLoadError]);

  const loadDeals = useCallback(async (q = "", workspaceId = "", page = 0) => {
    setDealsPage((current) => ({ ...current, page, loading: true }));
    try {
      const next = await api.deals(q, workspaceId, PAGE_SIZE, page * PAGE_SIZE);
      setDeals(next ?? []);
      setDealsPage({ page, loading: false, hasNext: next.length === PAGE_SIZE });
    } catch (error) {
      setDealsPage((current) => ({ ...current, loading: false }));
      setLoadError(error);
    }
  }, [setLoadError]);

  const loadData = useCallback(async (organizationIdOverride = "") => {
    setState("loading");
    try {
      const meData = await api.me();
      const orgs = meData.organizations ?? [];
      const storedOrg = organizationIdOverride || storedOrganizationId();
      const selectedOrg = orgs.find((org) => org.organization_id === storedOrg)?.organization_id || (orgs.length === 1 ? orgs[0].organization_id : "");
      setMe(meData);
      setOrganizations(orgs);
      setSelectedOrganizationIdState(selectedOrg);
      if (!selectedOrg) {
        setState("needs-organization");
        return;
      }
      setSelectedOrganizationId(selectedOrg);
      const [workspaceData, peopleData, companyData, taskData, dealData, suggestionData] = await Promise.all([
        api.workspaces(),
        api.people("", "", PAGE_SIZE, 0),
        api.companies("", "", PAGE_SIZE, 0),
        api.tasks({ limit: PAGE_SIZE, offset: 0 }),
        api.deals("", "", PAGE_SIZE, 0),
        api.suggestions(),
      ]);
      setWorkspaces(workspaceData ?? []);
      setPeople(peopleData ?? []);
      setCompanies(companyData ?? []);
      setTasks(taskData ?? []);
      setDeals(dealData ?? []);
      setSuggestions(suggestionData ?? []);
      setPeoplePage({ page: 0, loading: false, hasNext: (peopleData ?? []).length === PAGE_SIZE });
      setCompaniesPage({ page: 0, loading: false, hasNext: (companyData ?? []).length === PAGE_SIZE });
      setTasksPage({ page: 0, loading: false, hasNext: (taskData ?? []).length === PAGE_SIZE });
      setDealsPage({ page: 0, loading: false, hasNext: (dealData ?? []).length === PAGE_SIZE });
      setState("ready");
    } catch (error) {
      setLoadError(error);
    }
  }, [setLoadError]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  return {
    state,
    loadData,
    me,
    organizations,
    selectedOrganizationId: selectedOrganizationIdState,
    setSelectedOrganizationId: setSelectedOrganizationIdState,
    workspaces,
    people,
    companies,
    tasks,
    deals,
    suggestions,
    peoplePage,
    companiesPage,
    tasksPage,
    dealsPage,
    loadPeople,
    loadCompanies,
    loadTasks,
    loadDeals,
    setPeople,
    setCompanies,
    setTasks,
    setDeals,
    setSuggestions,
  };
}

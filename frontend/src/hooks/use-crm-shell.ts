"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api, Me, OrganizationMembership, setSelectedOrganizationId, storedOrganizationId, Workspace } from "@/lib/api";

export type ShellState = "loading" | "ready" | "error" | "unauthorized" | "needs-organization";

export function useCrmShell() {
  const [me, setMe] = useState<Me | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [selectedOrganizationIdState, setSelectedOrganizationIdState] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [state, setState] = useState<ShellState>("loading");
  const requestIdRef = useRef(0);

  const setLoadError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    const lowerMessage = message.toLowerCase();
    setState(lowerMessage.includes("missing session") || lowerMessage.includes("invalid session") ? "unauthorized" : "error");
  }, []);

  const loadShell = useCallback(async (organizationIdOverride = "") => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState("loading");
    try {
      const meData = await api.me();
      if (requestId !== requestIdRef.current) return;
      const orgs = meData.organizations ?? [];
      const storedOrg = organizationIdOverride || storedOrganizationId();
      const selectedOrg = orgs.find((org) => org.organization_id === storedOrg)?.organization_id || (orgs.length === 1 ? orgs[0].organization_id : "");

      setMe(meData);
      setOrganizations(orgs);
      setSelectedOrganizationIdState(selectedOrg);

      if (!selectedOrg) {
        setWorkspaces([]);
        setState("needs-organization");
        return;
      }

      setSelectedOrganizationId(selectedOrg);
      const workspaceData = await api.workspaces();
      if (requestId !== requestIdRef.current) return;
      setWorkspaces(workspaceData ?? []);
      setState("ready");
    } catch (error) {
      if (requestId === requestIdRef.current) setLoadError(error);
    }
  }, [setLoadError]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadShell();
    });
  }, [loadShell]);

  return {
    state,
    loadShell,
    me,
    organizations,
    selectedOrganizationId: selectedOrganizationIdState,
    setSelectedOrganizationId: setSelectedOrganizationIdState,
    workspaces,
  };
}

"use client";

import { useEffect, useMemo, useState } from "react";

import { api, Company, Person, Todo } from "@/lib/api";

export type DashboardDealRelations = Record<string, { people: Person[]; companies: Company[] }>;

export function useDashboardDealRelations(tasks: Todo[]) {
  const [dealRelations, setDealRelations] = useState<DashboardDealRelations>({});
  const dealIdsKey = useMemo(() => [...new Set(tasks.filter((task) => task.entity_type === "deal" && task.entity_id).map((task) => task.entity_id))].join(","), [tasks]);

  useEffect(() => {
    let cancelled = false;
    const dealIds = dealIdsKey ? dealIdsKey.split(",") : [];
    const missingDealIds = dealIds.filter((id) => !dealRelations[id]);
    if (!missingDealIds.length) return;

    async function loadDealRelations() {
      const entries = await Promise.all(missingDealIds.map(async (dealId) => {
        try {
          const [linkedPeople, linkedCompanies] = await Promise.all([api.dealPeople(dealId), api.dealCompanies(dealId)]);
          return [dealId, { people: linkedPeople ?? [], companies: linkedCompanies ?? [] }] as const;
        } catch {
          return [dealId, { people: [], companies: [] }] as const;
        }
      }));
      if (!cancelled) setDealRelations((current) => ({ ...current, ...Object.fromEntries(entries) }));
    }

    void loadDealRelations();
    return () => { cancelled = true; };
  }, [dealIdsKey, dealRelations]);

  return dealRelations;
}

import { cookies } from "next/headers";

import { CompaniesView } from "@/components/views/companies-view";

export default async function CompaniesPage() {
  const cookieStore = await cookies();
  const initialSidebarCollapsed = cookieStore.get("crme_sidebar_collapsed")?.value === "true";
  const initialWorkspaceId = cookieStore.get("crme_workspace_id")?.value || "all";

  return <CompaniesView initialSidebarCollapsed={initialSidebarCollapsed} initialWorkspaceId={initialWorkspaceId} />;
}

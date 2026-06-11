import { cookies } from "next/headers";

import { DealsView } from "@/components/views/deals-view";

export default async function DealsPage() {
  const cookieStore = await cookies();
  const initialSidebarCollapsed = cookieStore.get("crme_sidebar_collapsed")?.value === "true";
  const initialWorkspaceId = cookieStore.get("crme_workspace_id")?.value || "all";

  return <DealsView initialSidebarCollapsed={initialSidebarCollapsed} initialWorkspaceId={initialWorkspaceId} />;
}

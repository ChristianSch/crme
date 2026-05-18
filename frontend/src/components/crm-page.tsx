import { cookies } from "next/headers";

import { CrmApp } from "@/components/crm-app";
import { type AppView } from "@/components/app/sidebar-nav";

export async function CrmPage({ view }: { view: AppView }) {
  const cookieStore = await cookies();
  const initialSidebarCollapsed = cookieStore.get("crme_sidebar_collapsed")?.value === "true";
  const initialWorkspaceId = cookieStore.get("crme_workspace_id")?.value || "all";

  return <CrmApp view={view} initialSidebarCollapsed={initialSidebarCollapsed} initialWorkspaceId={initialWorkspaceId} />;
}

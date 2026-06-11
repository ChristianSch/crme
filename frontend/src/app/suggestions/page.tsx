import { cookies } from "next/headers";

import { SuggestionsView } from "@/components/views/suggestions-view";

export default async function SuggestionsPage() {
  const cookieStore = await cookies();
  const initialSidebarCollapsed = cookieStore.get("crme_sidebar_collapsed")?.value === "true";
  const initialWorkspaceId = cookieStore.get("crme_workspace_id")?.value || "all";

  return <SuggestionsView initialSidebarCollapsed={initialSidebarCollapsed} initialWorkspaceId={initialWorkspaceId} />;
}

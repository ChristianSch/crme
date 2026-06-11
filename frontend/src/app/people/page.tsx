import { cookies } from "next/headers";

import { PeopleView } from "@/components/views/people-view";

export default async function PeoplePage() {
  const cookieStore = await cookies();
  const initialSidebarCollapsed = cookieStore.get("crme_sidebar_collapsed")?.value === "true";
  const initialWorkspaceId = cookieStore.get("crme_workspace_id")?.value || "all";

  return <PeopleView initialSidebarCollapsed={initialSidebarCollapsed} initialWorkspaceId={initialWorkspaceId} />;
}

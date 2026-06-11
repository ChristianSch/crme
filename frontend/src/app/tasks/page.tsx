import { cookies } from "next/headers";

import { TasksView } from "@/components/views/tasks-view";

export default async function TasksPage() {
  const cookieStore = await cookies();
  const initialSidebarCollapsed = cookieStore.get("crme_sidebar_collapsed")?.value === "true";
  const initialWorkspaceId = cookieStore.get("crme_workspace_id")?.value || "all";

  return <TasksView initialSidebarCollapsed={initialSidebarCollapsed} initialWorkspaceId={initialWorkspaceId} />;
}

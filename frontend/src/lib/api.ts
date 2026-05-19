export type ID = string;

export type User = {
  id: ID;
  email: string;
};

export type OrganizationMembership = {
  organization_id: ID;
  user_id?: ID;
  role: "owner" | "admin" | "member" | "viewer" | string;
  name: string;
};

export type Capabilities = {
  role?: string;
  admin: boolean;
  can_manage_organization: boolean;
  can_manage_members: boolean;
  can_invite_members: boolean;
  can_write_crm: boolean;
  can_delete_crm: boolean;
  can_create_organization: boolean;
};

export type Me = {
  user: User;
  organizations: OrganizationMembership[];
  current_organization_id?: ID;
  capabilities: Capabilities;
};

export type Organization = {
  id: ID;
  name: string;
};

export type OrganizationMember = {
  organization_id: ID;
  user_id: ID;
  email: string;
  role: "owner" | "admin" | "member" | "viewer" | string;
  created_at: string;
  updated_at: string;
};

export type OrganizationInvitation = {
  id?: ID;
  organization_id?: ID;
  organization_name: string;
  email: string;
  role: "admin" | "member" | "viewer" | string;
  expires_at: string;
  accepted_at?: string;
  created_at?: string;
};

export type Workspace = {
  id: ID;
  name: string;
  description: string;
};

export type WorkspaceEntity = {
  workspace_id: ID;
  entity_type: "person" | "company" | "deal" | "task";
  entity_id: ID;
  title: string;
  subtitle: string;
};

export type Person = {
  id: ID;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  title: string;
  linkedin_url: string;
  city: string;
  company_name?: string;
  status: string;
  source: string;
  my_turn: boolean;
  last_touch_at?: string;
  created_at: string;
  updated_at: string;
};

export type Company = {
  id: ID;
  name: string;
  domain: string;
  last_touch_at?: string;
  created_at: string;
  updated_at: string;
};

export type Deal = {
  id: ID;
  workspace_id?: ID;
  name: string;
  stage: string;
  value_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type Todo = {
  id: ID;
  workspace_id?: ID;
  entity_type: "person" | "company" | "deal" | "task" | "activity" | "";
  entity_id: ID;
  title: string;
  body: string;
  due_at?: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "done";
  created_at: string;
  completed_at?: string;
};

export type ActivityType = "note" | "call" | "meeting" | "email";

export type TimelineItem = {
  kind: string;
  id: ID;
  entity_type: string;
  entity_id: ID;
  type?: ActivityType;
  title?: string;
  body?: string;
  private_body?: string;
  private_detail?: boolean;
  private_detail_own?: boolean;
  at: string;
};

export type Suggestion = {
  id: ID;
  kind: "new_contact" | "new_company" | "possible_merge" | "follow_up" | "deal_stage_nudge";
  entity_type: string;
  entity_id: ID;
  target_type?: string;
  target_identifier?: string;
  title: string;
  body: string;
  status: "open" | "accepted" | "dismissed";
  last_touch_at?: string;
  created_at: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantAction = {
  command: string;
  args?: string[];
};

export type EmailAccount = {
  id: ID;
  organization_id?: ID;
  owner_user_id?: ID;
  name: string;
  email: string;
  imap_host: string;
  imap_port: number;
  imap_username: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  secret_ref?: string;
  sync_enabled: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: ID;
  actor_user_id?: ID;
  actor_email?: string;
  action: string;
  target_type?: string;
  target_id?: ID;
  details?: Record<string, unknown>;
  created_at: string;
};

export type AssistantConversation = {
  id: ID;
  title: string;
  messages: ChatMessage[];
  pending_action?: AssistantAction;
  created_at: string;
  updated_at: string;
};

export type EntityRef = {
  entity_type: "person" | "company" | "deal" | "task";
  entity_id: ID;
  title: string;
  subtitle: string;
};

export type ChatResult = {
  text: string;
  pending_action?: AssistantAction;
  entities?: EntityRef[];
  conversation_id?: ID;
};

export type GlobalSearchResults = {
  people: Person[];
  companies: Company[];
  deals: Deal[];
  tasks: Todo[];
};

export type AcceptSuggestionResult = {
  result: unknown;
  created: boolean;
  created_entity_type?: "person" | "company";
  created_entity_id?: ID;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const ORGANIZATION_STORAGE_KEY = "crme:organization_id";

let selectedOrganizationId = "";

export function setSelectedOrganizationId(id: ID) {
  selectedOrganizationId = id;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ORGANIZATION_STORAGE_KEY, id);
  }
}

export function clearSelectedOrganizationId() {
  selectedOrganizationId = "";
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
  }
}

export function storedOrganizationId() {
  if (selectedOrganizationId) return selectedOrganizationId;
  if (typeof window === "undefined") return "";
  selectedOrganizationId = window.localStorage.getItem(ORGANIZATION_STORAGE_KEY) || "";
  return selectedOrganizationId;
}

function pathWithOrganization(path: string) {
  if (path.startsWith("/auth/") || path === "/me" || path.startsWith("/organizations")) return path;
  const organizationId = storedOrganizationId();
  if (!organizationId) return path;
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  if (!params.has("organization_id")) params.set("organization_id", organizationId);
  return `${pathname}?${params}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${pathWithOrganization(path)}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

export const api = {
  requestMagicLink(email: string, signup = false) {
    return request<{ status: string }>("/auth/magic-link", {
      method: "POST",
      body: JSON.stringify({ email, signup }),
    });
  },
  logout() {
    clearSelectedOrganizationId();
    return request<{ status: string }>("/auth/logout", { method: "POST" });
  },
  me() {
    return request<Me>("/me");
  },
  organizations() {
    return request<OrganizationMembership[]>("/organizations");
  },
  createOrganization(name: string) {
    return request<Organization>("/organizations", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },
  organizationMembers(organizationId: ID) {
    return request<OrganizationMember[]>(`/organizations/${organizationId}/members`);
  },
  updateOrganizationMemberRole(organizationId: ID, userId: ID, role: OrganizationMember["role"]) {
    return request<OrganizationMember>(`/organizations/${organizationId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },
  removeOrganizationMember(organizationId: ID, userId: ID) {
    return request<{ status: string }>(`/organizations/${organizationId}/members/${userId}`, { method: "DELETE" });
  },
  organizationInvitations(organizationId: ID) {
    return request<OrganizationInvitation[]>(`/organizations/${organizationId}/invitations`);
  },
  inviteOrganizationMember(organizationId: ID, email: string, role: OrganizationInvitation["role"] = "member") {
    return request<OrganizationInvitation>(`/organizations/${organizationId}/invitations`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  },
  resendOrganizationInvitation(organizationId: ID, invitationId: ID) {
    return request<OrganizationInvitation>(`/organizations/${organizationId}/invitations/${invitationId}/resend`, { method: "POST" });
  },
  invitation(token: string) {
    return request<OrganizationInvitation>(`/invitations/${encodeURIComponent(token)}`);
  },
  acceptInvitation(token: string) {
    return request<OrganizationInvitation>(`/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" });
  },
  emailAccounts() {
    return request<EmailAccount[]>("/email/accounts?limit=100");
  },
  createEmailAccount(input: Partial<EmailAccount> & { secret?: string }) {
    return request<EmailAccount>("/email/accounts", { method: "POST", body: JSON.stringify(input) });
  },
  testEmailAccount(input: Partial<EmailAccount> & { secret?: string }) {
    return request<{ status: string }>("/email/accounts/test", { method: "POST", body: JSON.stringify(input) });
  },
  updateEmailAccount(id: ID, input: Partial<EmailAccount> & { secret?: string }) {
    return request<EmailAccount>(`/email/accounts/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  deleteEmailAccount(id: ID) {
    return request<{ status: string }>(`/email/accounts/${id}`, { method: "DELETE" });
  },
  auditLogs() {
    return request<AuditLog[]>("/audit-logs?limit=100");
  },
  workspaces() {
    return request<Workspace[]>("/workspaces?limit=100");
  },
  workspaceEntities(workspaceId: ID, entityType?: WorkspaceEntity["entity_type"]) {
    const params = new URLSearchParams({ limit: "500" });
    if (entityType) params.set("entity_type", entityType);
    return request<WorkspaceEntity[]>(`/workspaces/${workspaceId}/entities?${params}`);
  },
  createPerson(input: Partial<Person> & { workspace_id?: ID }) {
    return request<Person>("/people", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updatePerson(person: Person) {
    return request<Person>(`/people/${person.id}?replace=true`, {
      method: "PUT",
      body: JSON.stringify(person),
    });
  },
  people(q = "", workspaceId = "", limit = 50, offset = 0) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (q) params.set("q", q);
    if (workspaceId) params.set("workspace_id", workspaceId);
    return request<Person[]>(`/people?${params}`);
  },
  companies(q = "", workspaceId = "", limit = 50, offset = 0) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (q) params.set("q", q);
    if (workspaceId) params.set("workspace_id", workspaceId);
    return request<Company[]>(`/companies?${params}`);
  },
  createCompany(input: Partial<Company> & { workspace_id?: ID }) {
    return request<Company>("/companies", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateCompany(company: Company) {
    return request<Company>(`/companies/${company.id}?replace=true`, {
      method: "PUT",
      body: JSON.stringify(company),
    });
  },
  linkPersonCompany(personId: ID, companyId: ID, role = "") {
    return request<{ status: string }>("/relationships/person-company", {
      method: "POST",
      body: JSON.stringify({ person_id: personId, company_id: companyId, role }),
    });
  },
  unlinkPersonCompany(personId: ID, companyId: ID) {
    return request<{ status: string }>("/relationships/person-company", {
      method: "DELETE",
      body: JSON.stringify({ person_id: personId, company_id: companyId }),
    });
  },
  personCompanies(personId: ID) {
    return request<Company[]>(`/people/${personId}/companies?limit=20`);
  },
  companyPeople(companyId: ID) {
    return request<Person[]>(`/companies/${companyId}/people?limit=100`);
  },
  deletePerson(id: ID) {
    return request<{ status: string }>(`/people/${id}`, { method: "DELETE" });
  },
  deleteCompany(id: ID) {
    return request<{ status: string }>(`/companies/${id}`, { method: "DELETE" });
  },
  deals(q = "", workspaceId = "", limit = 50, offset = 0) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (q) params.set("q", q);
    if (workspaceId) params.set("workspace_id", workspaceId);
    return request<Deal[]>(`/deals?${params}`);
  },
  createDeal(input: Partial<Deal>) {
    return request<Deal>("/deals", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateDeal(deal: Deal) {
    return request<Deal>(`/deals/${deal.id}`, {
      method: "PUT",
      body: JSON.stringify(deal),
    });
  },
  deleteDeal(id: ID) {
    return request<{ status: string }>(`/deals/${id}`, { method: "DELETE" });
  },
  dealPeople(dealId: ID) {
    return request<Person[]>(`/deals/${dealId}/people?limit=100`);
  },
  dealCompanies(dealId: ID) {
    return request<Company[]>(`/deals/${dealId}/companies?limit=100`);
  },
  linkDealPerson(dealId: ID, personId: ID) {
    return request<{ status: string }>("/relationships/deal-person", {
      method: "POST",
      body: JSON.stringify({ deal_id: dealId, person_id: personId }),
    });
  },
  unlinkDealPerson(dealId: ID, personId: ID) {
    return request<{ status: string }>("/relationships/deal-person", {
      method: "DELETE",
      body: JSON.stringify({ deal_id: dealId, person_id: personId }),
    });
  },
  linkDealCompany(dealId: ID, companyId: ID) {
    return request<{ status: string }>("/relationships/deal-company", {
      method: "POST",
      body: JSON.stringify({ deal_id: dealId, company_id: companyId }),
    });
  },
  unlinkDealCompany(dealId: ID, companyId: ID) {
    return request<{ status: string }>("/relationships/deal-company", {
      method: "DELETE",
      body: JSON.stringify({ deal_id: dealId, company_id: companyId }),
    });
  },
  tasks(params?: { q?: string; status?: "open" | "done" | "all"; due?: "today" | "overdue" | "upcoming" | "none" | "all"; entity_type?: Todo["entity_type"]; entity_id?: ID; workspace_id?: ID; limit?: number; offset?: number }) {
    const query = new URLSearchParams({ limit: String(params?.limit ?? 50), offset: String(params?.offset ?? 0) });
    if (params?.q) query.set("q", params.q);
    if (params?.status && params.status !== "all") query.set("status", params.status);
    if (params?.due && params.due !== "all") query.set("due", params.due);
    if (params?.entity_type) query.set("entity_type", params.entity_type);
    if (params?.entity_id) query.set("entity_id", params.entity_id);
    if (params?.workspace_id) query.set("workspace_id", params.workspace_id);
    return request<Todo[]>(`/tasks?${query}`);
  },
  createTask(input: Partial<Todo>) {
    return request<Todo>("/tasks", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateTask(task: Todo) {
    return request<Todo>(`/tasks/${task.id}`, {
      method: "PUT",
      body: JSON.stringify(task),
    });
  },
  completeTask(id: ID) {
    return request<Todo>(`/tasks/${id}/complete`, { method: "POST" });
  },
  deleteTask(id: ID) {
    return request<{ status: string }>(`/tasks/${id}`, { method: "DELETE" });
  },
  suggestions(status = "open", limit = 50, offset = 0) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (status) params.set("status", status);
    return request<Suggestion[]>(`/ai/prompts?${params}`);
  },
  acceptSuggestion(id: ID) {
    return request<AcceptSuggestionResult>("/ai/prompts/accept", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  },
  linkSuggestionPerson(id: ID, personId: ID) {
    return request<Person>("/ai/prompts/link-person", {
      method: "POST",
      body: JSON.stringify({ id, person_id: personId }),
    });
  },
  linkSuggestionCompany(id: ID, companyId: ID) {
    return request<Company>("/ai/prompts/link-company", {
      method: "POST",
      body: JSON.stringify({ id, company_id: companyId }),
    });
  },
  dismissSuggestion(id: ID) {
    return request<Suggestion>("/ai/prompts/resolve", {
      method: "POST",
      body: JSON.stringify({ id, status: "dismissed" }),
    });
  },
  suppressSuggestion(id: ID) {
    return request<Suggestion>("/ai/prompts/resolve", {
      method: "POST",
      body: JSON.stringify({ id, status: "dismissed", suppress: true }),
    });
  },
  reopenSuggestion(id: ID) {
    return request<Suggestion>("/ai/prompts/resolve", {
      method: "POST",
      body: JSON.stringify({ id, status: "open" }),
    });
  },
  conversations(limit = 5) {
    return request<AssistantConversation[]>(`/ai/conversations?limit=${limit}`);
  },
  chat(messages: ChatMessage[], conversationId?: ID) {
    return request<ChatResult>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ messages, conversation_id: conversationId || undefined }),
    });
  },
  executeAssistantAction(action: AssistantAction) {
    return request<unknown>("/ai/actions/execute", { method: "POST", body: JSON.stringify(action) });
  },
  async globalSearch(q: string, workspaceId = "", limit = 6): Promise<GlobalSearchResults> {
    const [people, companies, deals, tasks] = await Promise.all([
      api.people(q, workspaceId, limit, 0),
      api.companies(q, workspaceId, limit, 0),
      api.deals(q, workspaceId, limit, 0),
      api.tasks({ q, workspace_id: workspaceId || undefined, status: "all", limit, offset: 0 }),
    ]);
    return { people: people ?? [], companies: companies ?? [], deals: deals ?? [], tasks: tasks ?? [] };
  },
  updateActivity(input: { id: ID; type: ActivityType; body: string; occurred_at: string }) {
    return request<{ id: ID }>(`/activities/${input.id}`, {
      method: "PUT",
      body: JSON.stringify({
        id: input.id,
        type: input.type,
        body: input.body,
        occurred_at: input.occurred_at,
      }),
    });
  },
  updateNote(input: { id: ID; body: string; occurred_at: string }) {
    return request<{ id: ID }>(`/notes/${input.id}`, {
      method: "PUT",
      body: JSON.stringify({
        id: input.id,
        type: "note",
        body: input.body,
        occurred_at: input.occurred_at,
      }),
    });
  },
  deleteActivity(id: ID) {
    return request<{ status: string }>(`/activities/${id}`, { method: "DELETE" });
  },
  deleteNote(id: ID) {
    return request<{ status: string }>(`/notes/${id}`, { method: "DELETE" });
  },
  createActivity(input: { type: ActivityType; body: string; occurred_at: string; entity_type: "person" | "company" | "deal"; entity_id: ID }) {
    return request<{ id: ID }>("/activities", {
      method: "POST",
      body: JSON.stringify({
        activity: {
          type: input.type,
          body: input.body,
          occurred_at: input.occurred_at,
        },
        links: [
          {
            entity_type: input.entity_type,
            entity_id: input.entity_id,
          },
        ],
      }),
    });
  },
  timeline(entityType: "person" | "company" | "deal", entityId: ID) {
    return request<TimelineItem[]>(`/timeline/${entityType}/${entityId}`);
  },
};

export function fullName(person: Person) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ") || person.email || "Unnamed person";
}

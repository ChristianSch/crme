"use client";

import { ConfirmAction } from "@/components/common/confirm-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiToken, AuditLog, EmailAccount, OrganizationInvitation, OrganizationMember, OrganizationMembership } from "@/lib/api";
import { relativeDate } from "@/lib/format";

type RelationLoadState = "idle" | "loading" | "ready" | "error";

export const ORG_ROLES = ["owner", "admin", "member", "viewer"];

export function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function isPast(value: string) {
  return new Date(value).getTime() < new Date().getTime();
}

export function auditActionLabel(action: string) {
  return action.split(".").map(roleLabel).join(" ");
}

export function lastSyncLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (sameDay) {
    if (minutes < 60) return `today ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    return `today ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  return relativeDate(value);
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-6">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function TeamSection({ organization }: { organization?: OrganizationMembership }) {
  return (
    <SettingsSection title="Team" description="The active organization for shared CRM data.">
      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="text-sm font-medium">{organization?.name ?? "No team selected"}</div>
        <div className="mt-1 text-sm text-muted-foreground">Your role: <span className="capitalize text-foreground">{organization?.role ?? "unknown"}</span></div>
      </div>
    </SettingsSection>
  );
}

export function ApiTokensSection({ apiTokens, busyId, onOpenTokenSheet, onRevokeToken }: { apiTokens: ApiToken[]; busyId: string; onOpenTokenSheet: (kind: "crmctl" | "extension") => void; onRevokeToken: (token: ApiToken) => void }) {
  return (
    <SettingsSection title="API tokens" description="Create personal tokens for crmctl or other API clients.">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">Browser extension setup</div>
            <p className="mt-1 text-sm text-muted-foreground">Create a token for the LinkedIn extension and copy the server URL into the popup.</p>
          </div>
          <Button type="button" className="h-9 rounded-xl" onClick={() => onOpenTokenSheet("extension")}>Set up extension</Button>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" onClick={() => onOpenTokenSheet("crmctl")}>Create token</Button>
        </div>
        <div className="overflow-hidden rounded-xl border">
          {apiTokens.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No API tokens yet.</div> : (
            <div className="divide-y divide-border">
              {apiTokens.map((token) => (
                <div key={token.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{token.name}</div>
                    <div className="text-xs text-muted-foreground">Created {relativeDate(token.created_at)}{token.last_used_at ? ` · Last used ${relativeDate(token.last_used_at)}` : " · Never used"}</div>
                  </div>
                  <ConfirmAction trigger={<Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={busyId === token.id}>Revoke</Button>} title="Revoke API token?" description={`${token.name} will stop working for crmctl and other API clients.`} actionLabel="Revoke" onConfirm={() => onRevokeToken(token)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}

export function MembersSection({ state, error, members, canManage, busyId, onUpdateRole, onRemoveMember }: { state: RelationLoadState; error: string; members: OrganizationMember[]; canManage: boolean; busyId: string; onUpdateRole: (member: OrganizationMember, role: string) => void; onRemoveMember: (member: OrganizationMember) => void }) {
  return (
    <SettingsSection title="Members" description="Owners and admins can change roles or remove access.">
      <div className="overflow-hidden rounded-xl border">
        {state === "loading" ? <div className="p-4 text-sm text-muted-foreground">Loading members...</div> : state === "error" ? <div className="p-4 text-sm text-destructive">{error}</div> : members.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No members found.</div> : (
          <div className="divide-y divide-border">
            {members.map((member) => {
              const isLastOwner = member.role === "owner" && members.filter((item) => item.role === "owner").length <= 1;
              return (
                <div key={member.user_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{member.email}</div>
                    <div className="text-xs text-muted-foreground">Current role: <span className="capitalize">{member.role}</span></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={member.role} disabled={!canManage || isLastOwner || busyId === member.user_id} onValueChange={(role) => onUpdateRole(member, role)}>
                      <SelectTrigger aria-label={`Role for ${member.email}`} className="h-9 w-32 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent align="end" className="rounded-xl">{ORG_ROLES.map((role) => <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}</SelectContent>
                    </Select>
                    <ConfirmAction trigger={<Button variant="outline" className="h-9 rounded-xl bg-background" disabled={!canManage || isLastOwner || busyId === member.user_id}>Remove</Button>} title="Remove member?" description={`${member.email} will lose access to this team.`} actionLabel="Remove" onConfirm={() => onRemoveMember(member)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

export function EmailIntegrationsSection({ accounts, busyId, editingId, editingAccount, message, onAdd, onEdit, onEditingAccountChange, onCancelEdit, onSaveEdit, onSetSync, onDelete }: { accounts: EmailAccount[]; busyId: string; editingId: string; editingAccount: (EmailAccount & { secret?: string }) | null; message: string; onAdd: () => void; onEdit: (account: EmailAccount) => void; onEditingAccountChange: (account: EmailAccount & { secret?: string }) => void; onCancelEdit: () => void; onSaveEdit: (account: EmailAccount) => void; onSetSync: (account: EmailAccount, enabled: boolean) => void; onDelete: (account: EmailAccount) => void }) {
  return (
    <SettingsSection title="Email integrations" description="Connect and manage your own mailbox. Admins cannot see other users' email accounts.">
      <div className="space-y-4">
        <div className="flex justify-end"><Button type="button" className="h-9 rounded-xl" onClick={onAdd}>Add email integration</Button></div>
        <div className="overflow-hidden rounded-xl border">
          {accounts.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No email integrations yet.</div> : (
            <div className="divide-y divide-border">
              {accounts.map((account) => {
                const editingName = editingId === account.id;
                return (
                  <div key={account.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      {editingName && editingAccount ? (
                        <div className="grid gap-2 md:grid-cols-2">
                          <Input value={editingAccount.name || ""} onChange={(event) => onEditingAccountChange({ ...editingAccount, name: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="Email integration name" placeholder="Name" />
                          <Input value={editingAccount.email || ""} onChange={(event) => onEditingAccountChange({ ...editingAccount, email: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="Email address" placeholder="Email address" />
                          <Input value={editingAccount.imap_host || ""} onChange={(event) => onEditingAccountChange({ ...editingAccount, imap_host: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="IMAP host" placeholder="IMAP host" />
                          <Input value={String(editingAccount.imap_port || 993)} onChange={(event) => onEditingAccountChange({ ...editingAccount, imap_port: Number(event.target.value) || 993 })} className="h-9 rounded-xl bg-background" aria-label="IMAP port" placeholder="IMAP port" />
                          <Input value={editingAccount.imap_username || ""} onChange={(event) => onEditingAccountChange({ ...editingAccount, imap_username: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="IMAP username" placeholder="IMAP username" />
                          <Input value={editingAccount.smtp_host || ""} onChange={(event) => onEditingAccountChange({ ...editingAccount, smtp_host: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="SMTP host" placeholder="SMTP host" />
                          <Input value={editingAccount.smtp_username || ""} onChange={(event) => onEditingAccountChange({ ...editingAccount, smtp_username: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="SMTP username" placeholder="SMTP username" />
                          <Input value={editingAccount.secret || ""} onChange={(event) => onEditingAccountChange({ ...editingAccount, secret: event.target.value })} type="password" className="h-9 rounded-xl bg-background md:col-span-2" aria-label="App password" placeholder="New app password, optional" />
                          {message && <p className="text-sm text-destructive md:col-span-2">{message}</p>}
                          <div className="flex gap-2 pb-2 md:col-span-2">
                            <Button type="button" className="h-9 rounded-xl" disabled={busyId === account.id} onClick={() => onSaveEdit(account)}>{busyId === account.id ? "Testing..." : "Test & save"}</Button>
                            <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" onClick={onCancelEdit}>Cancel</Button>
                          </div>
                        </div>
                      ) : <div className="truncate text-sm font-medium">{account.name || "Untitled integration"}</div>}
                      <div className="mt-1 text-xs text-muted-foreground">{account.email} · {account.sync_enabled ? "Sync enabled" : "Sync disabled"}{account.last_synced_at ? ` · Last sync ${lastSyncLabel(account.last_synced_at)}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!editingName && <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={busyId === account.id} onClick={() => onEdit(account)}>Edit</Button>}
                      <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={busyId === account.id} onClick={() => onSetSync(account, !account.sync_enabled)}>{account.sync_enabled ? "Disable" : "Enable"}</Button>
                      <ConfirmAction trigger={<Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={busyId === account.id}>Remove</Button>} title="Remove email integration?" description={`${account.email} will stop syncing.`} actionLabel="Remove" onConfirm={() => onDelete(account)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}

export function InvitationsSection({ invitations, inviteEmail, inviteRole, message, canManage, inviting, busyId, onInviteEmailChange, onInviteRoleChange, onInvite, onResend }: { invitations: OrganizationInvitation[]; inviteEmail: string; inviteRole: string; message: string; canManage: boolean; inviting: boolean; busyId: string; onInviteEmailChange: (value: string) => void; onInviteRoleChange: (value: string) => void; onInvite: (event: React.FormEvent<HTMLFormElement>) => void; onResend: (invitation: OrganizationInvitation) => void }) {
  return (
    <SettingsSection title="Invite" description="Send a magic-link invitation to a teammate.">
      <div className="space-y-4">
        <form className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_140px_auto]" onSubmit={onInvite}>
          <Input value={inviteEmail} onChange={(event) => onInviteEmailChange(event.target.value)} type="email" required placeholder="teammate@example.com" className="h-9 rounded-xl bg-background" disabled={!canManage || inviting} />
          <Select value={inviteRole} disabled={!canManage || inviting} onValueChange={onInviteRoleChange}>
            <SelectTrigger aria-label="Invite role" className="h-9 rounded-xl bg-background"><SelectValue /></SelectTrigger>
            <SelectContent align="end" className="rounded-xl">{ORG_ROLES.filter((role) => role !== "owner").map((role) => <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="submit" className="h-9 rounded-xl" disabled={!canManage || inviting}>{inviting ? "Sending..." : "Invite"}</Button>
          {message && <p className="text-sm text-muted-foreground sm:col-span-3">{message}</p>}
        </form>
        <div className="overflow-hidden rounded-xl border">
          {invitations.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No invitations yet.</div> : (
            <div className="divide-y divide-border">
              {invitations.map((invitation) => {
                const accepted = Boolean(invitation.accepted_at);
                const expired = !accepted && isPast(invitation.expires_at);
                return (
                  <div key={invitation.id ?? invitation.email} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{invitation.email}</div>
                      <div className="text-xs text-muted-foreground">{roleLabel(invitation.role)} · {accepted ? "Accepted" : expired ? "Expired" : "Pending"}</div>
                    </div>
                    <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={!canManage || accepted || busyId === invitation.id} onClick={() => onResend(invitation)}>{busyId === invitation.id ? "Sending..." : "Resend"}</Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}

export function AuditLogSection({ auditLogs }: { auditLogs: AuditLog[] }) {
  return (
    <SettingsSection title="Audit log" description="Recent security-sensitive team events.">
      <div className="overflow-hidden rounded-xl border">
        {auditLogs.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No audit events yet.</div> : (
          <div className="divide-y divide-border">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-medium">{auditActionLabel(log.action)}</div>
                  <div className="text-xs text-muted-foreground">{relativeDate(log.created_at)}</div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{log.actor_email || "System"}{log.details?.email ? ` · ${String(log.details.email)}` : ""}{log.details?.role ? ` · ${String(log.details.role)}` : ""}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

"use client";

import { useState, type ComponentProps, type FormEvent } from "react";

import { ConfirmAction } from "@/components/common/confirm-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, API_URL, ApiToken, AuditLog, EmailAccount, OrganizationInvitation, OrganizationMember, OrganizationMembership } from "@/lib/api";
import { relativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type RelationLoadState = "idle" | "loading" | "ready" | "error";

function LabeledInput({ label, value, onChange, ...props }: { label: string; value: string; onChange: (value: string) => void } & Omit<ComponentProps<typeof Input>, "value" | "onChange">) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  );
}

export function SettingsPanel({ organization, members, invitations, emailAccounts, apiTokens, auditLogs, state, error, onRefresh, onToast }: { organization?: OrganizationMembership; members: OrganizationMember[]; invitations: OrganizationInvitation[]; emailAccounts: EmailAccount[]; apiTokens: ApiToken[]; auditLogs: AuditLog[]; state: RelationLoadState; error: string; onRefresh: () => Promise<void>; onToast: (message: string) => void }) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [busyMemberId, setBusyMemberId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");
  const [tokenName, setTokenName] = useState("crmctl");
  const [tokenSetupKind, setTokenSetupKind] = useState<"crmctl" | "extension">("crmctl");
  const [newToken, setNewToken] = useState("");
  const [tokenMessage, setTokenMessage] = useState("");
  const [creatingToken, setCreatingToken] = useState(false);
  const [tokenSheetOpen, setTokenSheetOpen] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const emptyEmailForm = { name: "", email: "", imap_host: "", imap_port: "993", imap_username: "", smtp_host: "", smtp_port: "587", smtp_username: "", secret: "" };
  const [emailForm, setEmailForm] = useState(emptyEmailForm);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTestState, setEmailTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [emailTestMessage, setEmailTestMessage] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [editingEmailAccountId, setEditingEmailAccountId] = useState("");
  const [editingEmailAccount, setEditingEmailAccount] = useState<(EmailAccount & { secret?: string }) | null>(null);
  const canManage = organization?.role === "owner" || organization?.role === "admin";

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    setInviting(true);
    setMessage("");
    try {
      await api.inviteOrganizationMember(organization.organization_id, inviteEmail, inviteRole);
      setInviteEmail("");
      await onRefresh();
      onToast("Invitation sent.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not send invitation");
    } finally {
      setInviting(false);
    }
  }

  async function updateRole(member: OrganizationMember, role: string) {
    if (!organization) return;
    setBusyMemberId(member.user_id);
    setMessage("");
    try {
      await api.updateOrganizationMemberRole(organization.organization_id, member.user_id, role);
      await onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update role");
    } finally {
      setBusyMemberId("");
    }
  }

  async function resendInvitation(invitation: OrganizationInvitation) {
    if (!organization || !invitation.id) return;
    setBusyMemberId(invitation.id);
    setMessage("");
    try {
      await api.resendOrganizationInvitation(organization.organization_id, invitation.id);
      await onRefresh();
      onToast("Invitation resent.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not resend invitation");
    } finally {
      setBusyMemberId("");
    }
  }

  async function removeMember(member: OrganizationMember) {
    if (!organization) return;
    setBusyMemberId(member.user_id);
    setMessage("");
    try {
      await api.removeOrganizationMember(organization.organization_id, member.user_id);
      await onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not remove member");
    } finally {
      setBusyMemberId("");
    }
  }

  async function createApiToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingToken(true);
    setTokenMessage("");
    setNewToken("");
    try {
      const token = await api.createApiToken(tokenName);
      setNewToken(token.token ?? "");
      setTokenName(tokenSetupKind === "extension" ? "Browser extension" : "crmctl");
      await onRefresh();
    } catch (err) {
      setTokenMessage(err instanceof Error ? err.message : "Could not create token");
    } finally {
      setCreatingToken(false);
    }
  }

  function openTokenSheet(kind: "crmctl" | "extension") {
    setTokenSetupKind(kind);
    setTokenName(kind === "extension" ? "Browser extension" : "crmctl");
    setNewToken("");
    setTokenMessage("");
    setTokenSheetOpen(true);
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      onToast(`${label} copied.`);
    } catch {
      onToast("Could not copy to clipboard.");
    }
  }

  async function revokeApiToken(token: ApiToken) {
    setBusyMemberId(token.id);
    setTokenMessage("");
    try {
      await api.revokeApiToken(token.id);
      await onRefresh();
      onToast("Token revoked.");
    } catch (err) {
      setTokenMessage(err instanceof Error ? err.message : "Could not revoke token");
    } finally {
      setBusyMemberId("");
    }
  }

  function emailPayload() {
    return { ...emailForm, imap_port: Number(emailForm.imap_port) || 993, smtp_port: Number(emailForm.smtp_port) || 587, sync_enabled: true };
  }

  function emailError(err: unknown, fallback: string) {
    const message = err instanceof Error ? err.message.trim() : "";
    if (!message) return fallback;
    if (message === "internal server error" || message.includes("runtime secret storage is not configured") || message.includes("email password storage is unavailable")) {
      return "Email password storage is unavailable. Please try again later.";
    }
    return message.replace(/^validation error:\s*/i, "");
  }

  async function testEmailAccount() {
    setEmailTestState("testing");
    setEmailTestMessage("");
    try {
      await api.testEmailAccount(emailPayload());
      setEmailTestState("success");
      setEmailTestMessage("Connection test succeeded.");
    } catch (err) {
      setEmailTestState("error");
      setEmailTestMessage(emailError(err, "Connection test failed"));
    }
  }

  async function saveEmailAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emailTestState !== "success") return;
    setSavingEmail(true);
    setEmailMessage("");
    try {
      await api.createEmailAccount(emailPayload());
      setEmailForm(emptyEmailForm);
      setEmailTestState("idle");
      setEmailTestMessage("");
      setEmailModalOpen(false);
      await onRefresh();
      onToast("Email integration added.");
    } catch (err) {
      setEmailMessage(emailError(err, "Could not save email integration"));
    } finally {
      setSavingEmail(false);
    }
  }

  async function saveEmailAccountEdit(account: EmailAccount) {
    if (!editingEmailAccount) return;
    setBusyMemberId(account.id);
    setEmailMessage("");
    try {
      await api.updateEmailAccount(account.id, editingEmailAccount);
      setEditingEmailAccountId("");
      setEditingEmailAccount(null);
      await onRefresh();
      onToast("Email integration updated.");
    } catch (err) {
      setEmailMessage(emailError(err, "Could not update email integration"));
    } finally {
      setBusyMemberId("");
    }
  }

  async function setEmailSync(account: EmailAccount, syncEnabled: boolean) {
    setBusyMemberId(account.id);
    setEmailMessage("");
    try {
      await api.updateEmailAccount(account.id, { ...account, sync_enabled: syncEnabled });
      await onRefresh();
    } catch (err) {
      setEmailMessage(emailError(err, "Could not update email integration"));
    } finally {
      setBusyMemberId("");
    }
  }

  async function deleteEmailAccount(account: EmailAccount) {
    setBusyMemberId(account.id);
    setEmailMessage("");
    try {
      await api.deleteEmailAccount(account.id);
      await onRefresh();
      onToast("Email integration removed.");
    } catch (err) {
      setEmailMessage(emailError(err, "Could not remove email integration"));
    } finally {
      setBusyMemberId("");
    }
  }

  return (
    <div className="divide-y divide-border">
      <section className="grid gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-6">
        <div>
          <h2 className="text-sm font-semibold">Team</h2>
          <p className="mt-1 text-sm text-muted-foreground">The active organization for shared CRM data.</p>
        </div>
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="text-sm font-medium">{organization?.name ?? "No team selected"}</div>
          <div className="mt-1 text-sm text-muted-foreground">Your role: <span className="capitalize text-foreground">{organization?.role ?? "unknown"}</span></div>
        </div>
      </section>

      <section className="grid gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-6">
        <div>
          <h2 className="text-sm font-semibold">API tokens</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create personal tokens for crmctl or other API clients.</p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium">Browser extension setup</div>
              <p className="mt-1 text-sm text-muted-foreground">Create a token for the LinkedIn extension and copy the server URL into the popup.</p>
            </div>
            <Button type="button" className="h-9 rounded-xl" onClick={() => openTokenSheet("extension")}>Set up extension</Button>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" onClick={() => openTokenSheet("crmctl")}>Create token</Button>
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
                    <ConfirmAction trigger={<Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={busyMemberId === token.id}>Revoke</Button>} title="Revoke API token?" description={`${token.name} will stop working for crmctl and other API clients.`} actionLabel="Revoke" onConfirm={() => revokeApiToken(token)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-6">
        <div>
          <h2 className="text-sm font-semibold">Members</h2>
          <p className="mt-1 text-sm text-muted-foreground">Owners and admins can change roles or remove access.</p>
        </div>
        <div className="overflow-hidden rounded-xl border">
          {state === "loading" ? (
            <div className="p-4 text-sm text-muted-foreground">Loading members...</div>
          ) : state === "error" ? (
            <div className="p-4 text-sm text-destructive">{error}</div>
          ) : members.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No members found.</div>
          ) : (
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
                    <Select value={member.role} disabled={!canManage || isLastOwner || busyMemberId === member.user_id} onValueChange={(role) => updateRole(member, role)}>
                      <SelectTrigger aria-label={`Role for ${member.email}`} className="h-9 w-32 rounded-xl bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end" className="rounded-xl">
                        {ORG_ROLES.map((role) => <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <ConfirmAction
                      trigger={<Button variant="outline" className="h-9 rounded-xl bg-background" disabled={!canManage || isLastOwner || busyMemberId === member.user_id}>Remove</Button>}
                      title="Remove member?"
                      description={`${member.email} will lose access to this team.`}
                      actionLabel="Remove"
                      onConfirm={() => removeMember(member)}
                    />
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-6">
        <div>
          <h2 className="text-sm font-semibold">Email integrations</h2>
          <p className="mt-1 text-sm text-muted-foreground">Connect and manage your own mailbox. Admins cannot see other users&apos; email accounts.</p>
        </div>
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button type="button" className="h-9 rounded-xl" onClick={() => { setEmailForm(emptyEmailForm); setEmailTestState("idle"); setEmailTestMessage(""); setEmailMessage(""); setEmailModalOpen(true); }}>Add email integration</Button>
          </div>
          <div className="overflow-hidden rounded-xl border">
            {emailAccounts.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No email integrations yet.</div> : (
              <div className="divide-y divide-border">
                {emailAccounts.map((account) => {
                  const editingName = editingEmailAccountId === account.id;
                  return (
                    <div key={account.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        {editingName && editingEmailAccount ? (
                          <div className="grid gap-2 md:grid-cols-2">
                            <Input value={editingEmailAccount.name || ""} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, name: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="Email integration name" placeholder="Name" />
                            <Input value={editingEmailAccount.email || ""} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, email: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="Email address" placeholder="Email address" />
                            <Input value={editingEmailAccount.imap_host || ""} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, imap_host: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="IMAP host" placeholder="IMAP host" />
                            <Input value={String(editingEmailAccount.imap_port || 993)} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, imap_port: Number(event.target.value) || 993 })} className="h-9 rounded-xl bg-background" aria-label="IMAP port" placeholder="IMAP port" />
                            <Input value={editingEmailAccount.imap_username || ""} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, imap_username: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="IMAP username" placeholder="IMAP username" />
                            <Input value={editingEmailAccount.smtp_host || ""} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, smtp_host: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="SMTP host" placeholder="SMTP host" />
                            <Input value={editingEmailAccount.smtp_username || ""} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, smtp_username: event.target.value })} className="h-9 rounded-xl bg-background" aria-label="SMTP username" placeholder="SMTP username" />
                            <Input value={editingEmailAccount.secret || ""} onChange={(event) => setEditingEmailAccount({ ...editingEmailAccount, secret: event.target.value })} type="password" className="h-9 rounded-xl bg-background md:col-span-2" aria-label="App password" placeholder="New app password, optional" />
                            {emailMessage && <p className="text-sm text-destructive md:col-span-2">{emailMessage}</p>}
                            <div className="flex gap-2 pb-2 md:col-span-2">
                              <Button type="button" className="h-9 rounded-xl" disabled={busyMemberId === account.id} onClick={() => saveEmailAccountEdit(account)}>{busyMemberId === account.id ? "Testing..." : "Test & save"}</Button>
                              <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" onClick={() => { setEditingEmailAccountId(""); setEditingEmailAccount(null); }}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="truncate text-sm font-medium">{account.name || "Untitled integration"}</div>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">{account.email} · {account.sync_enabled ? "Sync enabled" : "Sync disabled"}{account.last_synced_at ? ` · Last sync ${lastSyncLabel(account.last_synced_at)}` : ""}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!editingName && <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={busyMemberId === account.id} onClick={() => { setEmailMessage(""); setEditingEmailAccountId(account.id); setEditingEmailAccount(account); }}>Edit</Button>}
                        <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={busyMemberId === account.id} onClick={() => setEmailSync(account, !account.sync_enabled)}>{account.sync_enabled ? "Disable" : "Enable"}</Button>
                        <ConfirmAction trigger={<Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={busyMemberId === account.id}>Remove</Button>} title="Remove email integration?" description={`${account.email} will stop syncing.`} actionLabel="Remove" onConfirm={() => deleteEmailAccount(account)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-6">
        <div>
          <h2 className="text-sm font-semibold">Invite</h2>
          <p className="mt-1 text-sm text-muted-foreground">Send a magic-link invitation to a teammate.</p>
        </div>
        <div className="space-y-4">
          <form className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_140px_auto]" onSubmit={invite}>
            <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} type="email" required placeholder="teammate@example.com" className="h-9 rounded-xl bg-background" disabled={!canManage || inviting} />
            <Select value={inviteRole} disabled={!canManage || inviting} onValueChange={setInviteRole}>
              <SelectTrigger aria-label="Invite role" className="h-9 rounded-xl bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl">
                {ORG_ROLES.filter((role) => role !== "owner").map((role) => <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" className="h-9 rounded-xl" disabled={!canManage || inviting}>{inviting ? "Sending..." : "Invite"}</Button>
            {message && <p className="text-sm text-muted-foreground sm:col-span-3">{message}</p>}
          </form>
          <div className="overflow-hidden rounded-xl border">
            {invitations.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No invitations yet.</div>
            ) : (
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
                      <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={!canManage || accepted || busyMemberId === invitation.id} onClick={() => resendInvitation(invitation)}>
                        {busyMemberId === invitation.id ? "Sending..." : "Resend"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <Sheet open={tokenSheetOpen} onOpenChange={setTokenSheetOpen}>
        <SheetContent className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-xl">
          <SheetHeader className="border-b py-6 pl-6 pr-16 text-left">
            <SheetTitle className="text-xl tracking-[-0.025em]">{tokenSetupKind === "extension" ? "Set up browser extension" : "Create API token"}</SheetTitle>
            <SheetDescription>{tokenSetupKind === "extension" ? "Create a token for the LinkedIn extension. The token is shown once." : "Name this token so you can recognize it later. The crmctl setup command is shown once after creation."}</SheetDescription>
          </SheetHeader>
          {newToken ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-6">
              {tokenSetupKind === "extension" ? (
                <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <div>
                    <div className="text-sm font-medium">Extension setup code</div>
                    <p className="mt-1 text-sm text-muted-foreground">Copy this once, paste it into the extension popup, then test the connection.</p>
                  </div>
                  <div>
                    <code className="block max-h-36 overflow-y-auto whitespace-pre-wrap break-all rounded-lg border bg-background px-3 py-2 text-sm">{extensionSetupCode(newToken)}</code>
                    <Button type="button" variant="outline" className="mt-2 h-8 rounded-xl bg-background" onClick={() => copyText(extensionSetupCode(newToken), "Extension setup code")}>Copy setup code</Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <div className="text-sm font-medium">crmctl setup command</div>
                  <p className="mt-1 text-sm text-muted-foreground">Copy this command into your terminal.</p>
                  <code className="mt-3 block break-all rounded-lg border bg-background px-3 py-2 text-sm">crmctl auth set --api {apiEndpointLabel()} {newToken}</code>
                  <Button type="button" variant="outline" className="mt-3 h-8 rounded-xl bg-background" onClick={() => copyText(`crmctl auth set --api ${apiEndpointLabel()} ${newToken}`, "crmctl command")}>Copy command</Button>
                </div>
              )}
              <p className="text-sm text-muted-foreground">The token is only shown now. If you close this sheet before copying it, revoke this token and create a new one.</p>
              <div className="flex justify-end">
                <Button type="button" className="h-9 rounded-xl" onClick={() => setTokenSheetOpen(false)}>Done</Button>
              </div>
            </div>
          ) : (
            <form className="grid gap-4 px-6 py-6" onSubmit={createApiToken}>
              <LabeledInput label="Token name" value={tokenName} onChange={setTokenName} required placeholder={tokenSetupKind === "extension" ? "Browser extension" : "crmctl on MacBook"} />
              {tokenMessage && <p className="text-sm text-destructive">{tokenMessage}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={creatingToken} onClick={() => setTokenSheetOpen(false)}>Cancel</Button>
                <Button type="submit" className="h-9 rounded-xl" disabled={creatingToken}>{creatingToken ? "Creating..." : "Create token"}</Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <SheetContent className="w-full overflow-hidden p-0 sm:max-w-xl">
          <form className="flex h-full flex-col bg-[oklch(0.985_0.004_255)]" onSubmit={saveEmailAccount}>
            <SheetHeader className="border-b py-6 pl-6 pr-16 text-left">
              <SheetTitle className="text-xl tracking-[-0.025em]">Add email integration</SheetTitle>
              <SheetDescription>Test the IMAP connection before saving. The account cannot be saved until the test succeeds.</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-6">
              <LabeledInput label="Name" value={emailForm.name} onChange={(value) => { setEmailForm({ ...emailForm, name: value }); setEmailTestState("idle"); }} placeholder="Work" />
              <LabeledInput label="Email address" value={emailForm.email} onChange={(value) => { setEmailForm({ ...emailForm, email: value }); setEmailTestState("idle"); }} type="email" required placeholder="you@example.com" />
              <div className="grid gap-3 sm:grid-cols-2">
                <LabeledInput label="IMAP host" value={emailForm.imap_host} onChange={(value) => { setEmailForm({ ...emailForm, imap_host: value }); setEmailTestState("idle"); }} required placeholder="imap.example.com" />
                <LabeledInput label="IMAP port" value={emailForm.imap_port} onChange={(value) => { setEmailForm({ ...emailForm, imap_port: value }); setEmailTestState("idle"); }} inputMode="numeric" />
              </div>
              <LabeledInput label="IMAP username" value={emailForm.imap_username} onChange={(value) => { setEmailForm({ ...emailForm, imap_username: value }); setEmailTestState("idle"); }} placeholder="you@example.com" />
              <div className="grid gap-3 sm:grid-cols-2">
                <LabeledInput label="SMTP host" value={emailForm.smtp_host} onChange={(value) => setEmailForm({ ...emailForm, smtp_host: value })} placeholder="smtp.example.com" />
                <LabeledInput label="SMTP port" value={emailForm.smtp_port} onChange={(value) => setEmailForm({ ...emailForm, smtp_port: value })} inputMode="numeric" />
              </div>
              <LabeledInput label="SMTP username" value={emailForm.smtp_username} onChange={(value) => setEmailForm({ ...emailForm, smtp_username: value })} placeholder="you@example.com" />
              <LabeledInput label="App password" value={emailForm.secret} onChange={(value) => { setEmailForm({ ...emailForm, secret: value }); setEmailTestState("idle"); }} type="password" required />
              {emailTestMessage && <p className={cn("text-sm", emailTestState === "success" ? "text-emerald-600" : "text-destructive")}>{emailTestMessage}</p>}
              {emailMessage && <p className="text-sm text-destructive">{emailMessage}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t bg-background px-6 py-4">
              <Button type="button" variant="outline" className="h-9 rounded-xl bg-background" disabled={emailTestState === "testing"} onClick={testEmailAccount}>{emailTestState === "testing" ? "Testing..." : "Test connection"}</Button>
              <Button type="submit" className="h-9 rounded-xl" disabled={savingEmail || emailTestState !== "success"}>{savingEmail ? "Saving..." : "Save"}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {canManage && (
        <section className="grid gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-6">
          <div>
            <h2 className="text-sm font-semibold">Audit log</h2>
            <p className="mt-1 text-sm text-muted-foreground">Recent security-sensitive team events.</p>
          </div>
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
        </section>
      )}
    </div>
  );
}

function apiEndpointLabel() {
  if (typeof window === "undefined") return API_URL;
  if (API_URL.startsWith("http")) return API_URL;
  return new URL(API_URL, window.location.origin).toString().replace(/\/$/, "");
}

function extensionSetupCode(token: string) {
  const appUrl = typeof window === "undefined" ? "" : window.location.origin;
  const instance = appUrl ? new URL(appUrl).host : apiEndpointLabel();
  return JSON.stringify({ crmeUrl: apiEndpointLabel(), apiToken: token, appUrl, instance }, null, 2);
}

function auditActionLabel(action: string) {
  return action.split(".").map(roleLabel).join(" ");
}

function lastSyncLabel(value: string) {
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

const ORG_ROLES = ["owner", "admin", "member", "viewer"];

function isPast(value: string) {
  return new Date(value).getTime() < new Date().getTime();
}

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

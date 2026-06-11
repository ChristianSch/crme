"use client";

import { useState, type ComponentProps, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ApiTokensSection, AuditLogSection, EmailIntegrationsSection, InvitationsSection, MembersSection, TeamSection } from "@/components/views/settings-sections";
import { API_URL, ApiToken, AuditLog, EmailAccount, OrganizationInvitation, OrganizationMember, OrganizationMembership } from "@/lib/api";
import { cn } from "@/lib/utils";

type RelationLoadState = "idle" | "loading" | "ready" | "error";
type EmailAccountPayload = ReturnType<typeof buildEmailPayload>;
type EditableEmailAccount = EmailAccount & { secret?: string };

function LabeledInput({ label, value, onChange, ...props }: { label: string; value: string; onChange: (value: string) => void } & Omit<ComponentProps<typeof Input>, "value" | "onChange">) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  );
}

function buildEmailPayload(form: { name: string; email: string; imap_host: string; imap_port: string; imap_username: string; smtp_host: string; smtp_port: string; smtp_username: string; secret: string }) {
  return { ...form, imap_port: Number(form.imap_port) || 993, smtp_port: Number(form.smtp_port) || 587, sync_enabled: true };
}

export function SettingsPanel({ organization, members, invitations, emailAccounts, apiTokens, auditLogs, state, error, onRefresh, onToast, onInviteMember, onUpdateMemberRole, onResendInvitation, onRemoveMember, onCreateApiToken, onRevokeApiToken, onTestEmailAccount, onCreateEmailAccount, onUpdateEmailAccount, onSetEmailSync, onDeleteEmailAccount }: { organization?: OrganizationMembership; members: OrganizationMember[]; invitations: OrganizationInvitation[]; emailAccounts: EmailAccount[]; apiTokens: ApiToken[]; auditLogs: AuditLog[]; state: RelationLoadState; error: string; onRefresh: () => Promise<void>; onToast: (message: string) => void; onInviteMember: (email: string, role: string) => Promise<void>; onUpdateMemberRole: (member: OrganizationMember, role: string) => Promise<void>; onResendInvitation: (invitation: OrganizationInvitation) => Promise<void>; onRemoveMember: (member: OrganizationMember) => Promise<void>; onCreateApiToken: (name: string) => Promise<{ token?: string }>; onRevokeApiToken: (token: ApiToken) => Promise<void>; onTestEmailAccount: (payload: EmailAccountPayload) => Promise<void>; onCreateEmailAccount: (payload: EmailAccountPayload) => Promise<void>; onUpdateEmailAccount: (account: EmailAccount, payload: EditableEmailAccount) => Promise<void>; onSetEmailSync: (account: EmailAccount, syncEnabled: boolean) => Promise<void>; onDeleteEmailAccount: (account: EmailAccount) => Promise<void> }) {
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
  const [editingEmailAccount, setEditingEmailAccount] = useState<EditableEmailAccount | null>(null);
  const canManage = organization?.role === "owner" || organization?.role === "admin";

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    setInviting(true);
    setMessage("");
    try {
      await onInviteMember(inviteEmail, inviteRole);
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
      await onUpdateMemberRole(member, role);
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
      await onResendInvitation(invitation);
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
      await onRemoveMember(member);
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
      const token = await onCreateApiToken(tokenName);
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
      await onRevokeApiToken(token);
      await onRefresh();
      onToast("Token revoked.");
    } catch (err) {
      setTokenMessage(err instanceof Error ? err.message : "Could not revoke token");
    } finally {
      setBusyMemberId("");
    }
  }

  function emailPayload() {
    return buildEmailPayload(emailForm);
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
      await onTestEmailAccount(emailPayload());
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
      await onCreateEmailAccount(emailPayload());
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
      await onUpdateEmailAccount(account, editingEmailAccount);
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
      await onSetEmailSync(account, syncEnabled);
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
      await onDeleteEmailAccount(account);
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
      <TeamSection organization={organization} />
      <ApiTokensSection apiTokens={apiTokens} busyId={busyMemberId} onOpenTokenSheet={openTokenSheet} onRevokeToken={revokeApiToken} />
      <MembersSection state={state} error={error} members={members} canManage={canManage} busyId={busyMemberId} onUpdateRole={updateRole} onRemoveMember={removeMember} />
      <EmailIntegrationsSection
        accounts={emailAccounts}
        busyId={busyMemberId}
        editingId={editingEmailAccountId}
        editingAccount={editingEmailAccount}
        message={emailMessage}
        onAdd={() => { setEmailForm(emptyEmailForm); setEmailTestState("idle"); setEmailTestMessage(""); setEmailMessage(""); setEmailModalOpen(true); }}
        onEdit={(account) => { setEmailMessage(""); setEditingEmailAccountId(account.id); setEditingEmailAccount(account); }}
        onEditingAccountChange={setEditingEmailAccount}
        onCancelEdit={() => { setEditingEmailAccountId(""); setEditingEmailAccount(null); }}
        onSaveEdit={saveEmailAccountEdit}
        onSetSync={setEmailSync}
        onDelete={deleteEmailAccount}
      />
      <InvitationsSection
        invitations={invitations}
        inviteEmail={inviteEmail}
        inviteRole={inviteRole}
        message={message}
        canManage={canManage}
        inviting={inviting}
        busyId={busyMemberId}
        onInviteEmailChange={setInviteEmail}
        onInviteRoleChange={setInviteRole}
        onInvite={invite}
        onResend={resendInvitation}
      />

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

      {canManage && <AuditLogSection auditLogs={auditLogs} />}
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


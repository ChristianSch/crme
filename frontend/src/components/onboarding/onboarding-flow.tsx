"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type ID, setSelectedOrganizationId } from "@/lib/api";

const steps = ["Workspace", "Invite", "Import"] as const;
type Step = typeof steps[number];

export function OnboardingFlow() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("Workspace");
  const [organizationId, setOrganizationId] = useState<ID>("");
  const [organizationName, setOrganizationName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [sentInvites, setSentInvites] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const me = await api.me();
        if (cancelled) return;
        if (me.organizations.length > 0) {
          const current = me.current_organization_id || me.organizations[0].organization_id;
          setSelectedOrganizationId(current);
          router.replace("/dashboard");
          return;
        }
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load your account");
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [router]);

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const org = await api.createOrganization(organizationName);
      setOrganizationId(org.id);
      setSelectedOrganizationId(org.id);
      setStep("Invite");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create workspace");
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    setBusy(true);
    setError("");
    try {
      const invitation = await api.inviteOrganizationMember(organizationId, inviteEmail, inviteRole);
      setSentInvites((current) => [...current, invitation.email]);
      setInviteEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invitation");
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    router.replace("/dashboard");
  }

  if (loading) {
    return <OnboardingShell activeStep="Workspace"><p className="text-sm text-muted-foreground">Checking your account...</p></OnboardingShell>;
  }

  return (
    <OnboardingShell activeStep={step}>
      {step === "Workspace" ? (
        <form onSubmit={createWorkspace}>
          <h1 className="text-2xl font-semibold tracking-[-0.035em]">Create your workspace</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">This is where your people, companies, deals, tasks, and suggestions will live.</p>
          <label className="mb-1 mt-6 block text-xs font-medium text-muted-foreground">Workspace name</label>
          <Input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required placeholder="Acme Studio" className="h-10 rounded-xl bg-background" />
          <Button className="mt-4 h-10 w-full rounded-xl" type="submit" disabled={busy}>{busy ? "Creating..." : "Create workspace"}</Button>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </form>
      ) : step === "Invite" ? (
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.035em]">Invite teammates</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Bring in the people who should share this CRM. You can skip this and invite them later from settings.</p>
          <form className="mt-6 grid gap-3" onSubmit={sendInvite}>
            <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} type="email" required placeholder="teammate@example.com" className="h-10 rounded-xl bg-background" />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="h-10 rounded-xl bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button className="h-10 rounded-xl" type="submit" disabled={busy}>{busy ? "Sending..." : "Send invite"}</Button>
          </form>
          {sentInvites.length > 0 && (
            <div className="mt-4 rounded-xl border bg-muted/20 p-3 text-sm">
              <div className="font-medium">Invited</div>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {sentInvites.map((email) => <li key={email}>{email}</li>)}
              </ul>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button className="h-10 rounded-xl" type="button" onClick={() => setStep("Import")}>Continue <ArrowRight className="size-4" /></Button>
            <Button className="h-10 rounded-xl bg-background" type="button" variant="outline" onClick={() => setStep("Import")}>Skip for now</Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Upload className="size-5" /></div>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">Import existing data</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Soon you will be able to bring in contacts and companies from existing CRM exports. For now, start empty and add records from the app.</p>
          <div className="mt-6 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Importers for Twenty, Attio, and CSV are planned for this step.</div>
          <Button className="mt-5 h-10 w-full rounded-xl" type="button" onClick={finish}>Start empty <ArrowRight className="size-4" /></Button>
        </div>
      )}
    </OnboardingShell>
  );
}

function OnboardingShell({ activeStep, children }: { activeStep: Step; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-xl border bg-card p-8 shadow-[0_12px_36px_oklch(0.45_0.01_255_/_0.12)]">
        <p className="text-xs font-medium tracking-[-0.01em] text-muted-foreground">CRMe setup</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {steps.map((step) => {
            const activeIndex = steps.indexOf(activeStep);
            const stepIndex = steps.indexOf(step);
            const complete = stepIndex < activeIndex;
            return (
              <div key={step} className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground">
                <span className={complete || step === activeStep ? "flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground" : "flex size-5 items-center justify-center rounded-full border text-[10px]"}>
                  {complete ? <Check className="size-3" /> : stepIndex + 1}
                </span>
                <span className={step === activeStep ? "font-medium text-foreground" : ""}>{step}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}

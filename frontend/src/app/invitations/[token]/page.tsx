"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, OrganizationInvitation, setSelectedOrganizationId } from "@/lib/api";

const PENDING_INVITE_KEY = "crme:pending_invitation_token";

export default function InvitationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = params.token;
  const shouldAutoAccept = searchParams.get("accept") === "1";
  const [invitation, setInvitation] = useState<OrganizationInvitation | null>(null);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "accepting" | "signin" | "accepted" | "error">("loading");
  const [message, setMessage] = useState("");

  const acceptInvitation = useCallback(async () => {
    setState("accepting");
    setMessage("");
    try {
      const accepted = await api.acceptInvitation(token);
      if (accepted.organization_id) setSelectedOrganizationId(accepted.organization_id);
      window.localStorage.removeItem(PENDING_INVITE_KEY);
      setState("accepted");
      router.replace("/dashboard");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Could not accept invitation";
      if (text.toLowerCase().includes("unauthorized") || text.toLowerCase().includes("missing session") || text.toLowerCase().includes("invalid session")) {
        setState("signin");
        setMessage("Sign in with the invited email, then return here to accept.");
        return;
      }
      setMessage(text);
      setState("ready");
    }
  }, [router, token]);

  useEffect(() => {
    let cancelled = false;
    async function loadInvitation() {
      try {
        const next = await api.invitation(token);
        if (cancelled) return;
        setInvitation(next);
        setEmail(next.email);
        if (next.accepted_at) {
          setState("accepted");
          return;
        }
        try {
          await api.me();
          if (shouldAutoAccept) {
            void acceptInvitation();
            return;
          }
          setState("ready");
        } catch {
          setState("signin");
        }
      } catch (err) {
        if (cancelled) return;
        setMessage(err instanceof Error ? err.message : "Could not load invitation");
        setState("error");
      }
    }
    void loadInvitation();
    return () => { cancelled = true; };
  }, [acceptInvitation, shouldAutoAccept, token]);

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      window.localStorage.setItem(PENDING_INVITE_KEY, token);
      await api.requestMagicLink(email);
      setMessage("Magic link requested. Open it, then this invitation will continue.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not request magic link");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-[0_12px_36px_oklch(0.45_0.01_255_/_0.12)]">
        <p className="text-xs font-medium tracking-[-0.01em] text-muted-foreground">CRMe</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Team invitation</h1>
        {state === "loading" ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading invitation...</p>
        ) : state === "error" ? (
          <p className="mt-3 text-sm text-destructive">{message}</p>
        ) : invitation ? (
          <div className="mt-5 space-y-5">
            <div className="rounded-xl border bg-background p-4">
              <p className="text-sm font-medium">{invitation.organization_name}</p>
              <p className="mt-1 text-sm text-muted-foreground">Invited as <span className="capitalize text-foreground">{invitation.role}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">For {invitation.email}</p>
            </div>
            {state === "signin" ? (
              <form onSubmit={requestLink}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Email address</label>
                <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="h-10 rounded-xl bg-background" />
                <Button className="mt-3 h-10 w-full rounded-xl" type="submit">Send magic link to accept</Button>
              </form>
            ) : (
              <Button className="h-10 w-full rounded-xl" disabled={state === "accepting" || state === "accepted"} onClick={acceptInvitation}>
                {state === "accepting" ? "Accepting..." : state === "accepted" ? "Accepted" : "Accept invitation"}
              </Button>
            )}
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </div>
        ) : null}
      </div>
    </main>
  );
}

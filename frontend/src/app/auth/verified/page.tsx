"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { consumeAuthNextPath } from "@/components/auth/magic-link-card";
import { Button } from "@/components/ui/button";

export default function AuthVerifiedPage() {
  const router = useRouter();

  useEffect(() => {
    const pendingInvite = window.localStorage.getItem("crme:pending_invitation_token");
    if (pendingInvite) {
      router.replace(`/invitations/${encodeURIComponent(pendingInvite)}?accept=1`);
      return;
    }
    router.replace(consumeAuthNextPath() || "/onboarding");
  }, [router]);

  return <VerifiedShell />;
}

function VerifiedShell() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-[0_12px_36px_oklch(0.45_0.01_255_/_0.12)]">
        <p className="text-xs font-medium tracking-[-0.01em] text-muted-foreground">CRMe</p>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.025em]">Signing you in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your session is verified. Redirecting to setup.</p>
        <Button className="mt-5 h-10 rounded-xl" onClick={() => router.replace("/onboarding")}>Continue</Button>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

const AUTH_NEXT_KEY = "crme:auth_next";

type MagicLinkCardProps = {
  mode: "login" | "signup";
  nextPath?: string;
};

export function MagicLinkCard({ mode, nextPath }: MagicLinkCardProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const isSignup = mode === "signup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
        window.localStorage.setItem(AUTH_NEXT_KEY, nextPath);
      }
      await api.requestMagicLink(email, isSignup);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request magic link");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-[0_12px_36px_oklch(0.45_0.01_255_/_0.12)]">
        <form onSubmit={submit}>
          <p className="text-xs font-medium tracking-[-0.01em] text-muted-foreground">CRMe</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">{isSignup ? "Create your account" : "Sign in"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignup
              ? "Enter your email and we will send a magic link to create your account."
              : "Enter your email and we will send a magic link."}
          </p>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required aria-label="Email address" placeholder="you@example.com" className="mt-6 h-10 rounded-xl bg-background" />
          <Button className="mt-3 h-10 w-full rounded-xl" type="submit">{isSignup ? "Send sign-up link" : "Send magic link"}</Button>
          {sent && <p className="mt-3 text-sm text-[oklch(0.48_0.12_155)]">Magic link requested. Open the email to continue.</p>}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {isSignup ? "Already have access? " : "Need access? "}
          <Link className="font-medium text-foreground underline-offset-4 hover:underline" href={isSignup ? "/login" : "/signup"}>
            {isSignup ? "Sign in" : "Sign up"}
          </Link>
        </p>
      </div>
    </main>
  );
}

export function consumeAuthNextPath() {
  const nextPath = window.localStorage.getItem(AUTH_NEXT_KEY);
  window.localStorage.removeItem(AUTH_NEXT_KEY);
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) return "";
  return nextPath;
}

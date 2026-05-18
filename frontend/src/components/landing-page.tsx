"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, GitBranch, History, LinkIcon, MessageSquareText, MoveRight, Sparkles } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "How it works", href: "#product" },
  { label: "Open source", href: "#open-source" },
];

const approvalItems = [
  { kind: "new company", title: "Northstar Health", body: "From maya@northstar.health · Subject: Pilot rollout notes", lastTouch: "Last touch today" },
  { kind: "new contact", title: "Maya Chen", body: "Founder at Northstar Health · maya@northstar.health", lastTouch: "Last touch today" },
  { kind: "deal stage nudge", title: "Northstar pilot", body: "Offer sent for $18,000 · Stage: proposal", lastTouch: "Last touch yesterday" },
];

export function LandingPage() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let active = true;

    api.me()
      .then(() => {
        if (active) setIsSignedIn(true);
      })
      .catch(() => {
        if (active) setIsSignedIn(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[oklch(0.982_0.006_68)] text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] bg-[radial-gradient(circle_at_22%_12%,oklch(0.9_0.07_58_/_0.75),transparent_26%),radial-gradient(circle_at_78%_4%,oklch(0.88_0.025_255_/_0.8),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(oklch(0.2_0.006_255_/_0.035)_1px,transparent_1px),linear-gradient(90deg,oklch(0.2_0.006_255_/_0.035)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="CRMe home">
          <BrandMark size="sm" />
        </Link>
        <nav className="hidden items-center gap-2 text-sm font-medium md:flex" aria-label="Landing page sections">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full border border-border/70 bg-card/80 px-3.5 py-2 text-foreground/80 shadow-sm transition-colors hover:border-foreground/20 hover:bg-background hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <Button asChild className="h-9 rounded-xl px-4">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" className="h-9 rounded-xl bg-card px-4">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild className="h-9 rounded-xl px-4">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8 md:pt-16 lg:px-10 lg:pb-28">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl shrink-0 lg:w-[46%]">
            <p className="max-w-sm text-lg font-medium leading-7 tracking-[-0.035em] text-foreground sm:text-xl">
              Your ClientOS for relationship work that should not need manual upkeep.
            </p>
            <h1 className="mt-7 text-balance text-6xl font-semibold leading-[0.88] tracking-[-0.085em] sm:text-7xl lg:text-8xl">
              A CRM that does the work, not one that creates it.
            </h1>
            <p className="mt-7 max-w-xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl sm:leading-9">
              CRMe finds people, companies, tasks, and context in the background. Review proposed changes, edit what you want, and approve what becomes part of your CRM.
            </p>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              Open source, built for founders, solo consultants, and small teams.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {isSignedIn ? (
                <Button asChild className="h-11 rounded-xl px-5 text-sm">
                  <Link href="/dashboard">Dashboard <ArrowRight className="size-4" /></Link>
                </Button>
              ) : (
                <>
                  <Button asChild className="h-11 rounded-xl px-5 text-sm">
                    <Link href="/signup">Sign up <ArrowRight className="size-4" /></Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-xl bg-card px-5 text-sm">
                    <Link href="/login">Log in</Link>
                  </Button>
                </>
              )}
              <Button asChild variant="outline" className="h-11 rounded-xl bg-card px-5 text-sm">
                <Link href="https://github.com/christiansch/crme" target="_blank" rel="noreferrer"><GitBranch className="size-4" /> View on GitHub</Link>
              </Button>
            </div>
          </div>
          <div className="relative min-w-0 flex-1 lg:-mr-24 xl:-mr-36">
            <div className="absolute -left-8 -top-8 hidden size-36 rounded-full bg-[oklch(0.78_0.14_48_/_0.22)] blur-3xl lg:block" />
            <ProductFrame className="w-full min-w-[720px] origin-left rotate-[-1.2deg] lg:min-w-[820px]">
              <HeroProductMock />
            </ProductFrame>
          </div>
        </div>
      </section>

      <section id="product" className="relative z-10 border-y border-border bg-[oklch(0.976_0.004_255)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:px-10">
          <div className="lg:pt-8">
            <Badge variant="outline" className="h-7 rounded-full bg-background px-3 text-muted-foreground">Multi-turn creation</Badge>
            <h2 className="mt-5 max-w-xl text-balance text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">The agent prepares the records. You decide what becomes true.</h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">Ask for a relationship update in plain language. CRMe asks what it needs, then turns the answer into inspectable CRM changes.</p>
          </div>
          <ProductFrame>
            <AgentBuilder />
          </ProductFrame>
        </div>
      </section>

      <section id="control" className="relative z-10 mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <ProductFrame>
            <SuggestionApprovalMock />
          </ProductFrame>
          <div>
            <Badge variant="outline" className="h-7 rounded-full bg-card px-3 text-muted-foreground">Approval as a feature</Badge>
            <h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Nothing enters your CRM by accident.</h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">Email sync and custom activities like calls can surface useful records. CRMe still asks first, so newsletters, noreply senders, and low-signal activity do not pollute your CRM.</p>
            <div className="mt-7 grid gap-3 text-sm text-muted-foreground">
              <ProofLine>Suggestions wait for approval before records are created.</ProofLine>
              <ProofLine>Useful email and call context stays attached.</ProofLine>
              <ProofLine>Reject noisy sources without training your team to ignore the CRM.</ProofLine>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-border bg-card/60">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
          <div className="max-w-3xl">
            <h2 className="text-balance text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Add a contact and their companies in under a second.</h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">The extension extracts the person, role, and companies from LinkedIn. One click creates the record in CRMe with context already attached.</p>
          </div>
          <div className="mt-10">
            <LinkedInExtensionMock />
          </div>
        </div>
      </section>

      <section id="open-source" className="relative z-10 mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="grid gap-8 rounded-3xl border border-border bg-[oklch(0.18_0.006_255)] p-6 text-[oklch(0.96_0.004_255)] shadow-[0_24px_80px_oklch(0.35_0.012_255_/_0.18)] md:grid-cols-[0.9fr_1.1fr] md:p-10">
          <div>
            <Badge variant="outline" className="h-7 rounded-full border-[oklch(0.38_0.01_255)] bg-[oklch(0.23_0.006_255)] px-3 text-[oklch(0.75_0.006_255)]">Open source</Badge>
            <h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.055em]">Bring your existing CRM data.</h2>
            <p className="mt-5 text-base leading-7 text-[oklch(0.76_0.006_255)]">CRMe is open source and compatible with data from Attio and Twenty, so small teams can move without starting over.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Attio", "Import people, companies, and relationship context."],
              ["Twenty", "Bring structured CRM records into CRMe."],
              ["Open data", "Keep the system inspectable and portable."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-[oklch(0.32_0.008_255)] bg-[oklch(0.22_0.006_255)] p-4">
                <GitBranch className="size-4 text-[oklch(0.78_0.06_255)]" />
                <h3 className="mt-4 font-medium tracking-[-0.02em]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[oklch(0.7_0.006_255)]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-4xl px-5 pb-24 text-center sm:px-8 lg:px-10">
        <h2 className="text-balance text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Start with a CRM that respects your attention.</h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground">Let the agent prepare the work. Review the facts. Approve the records worth keeping.</p>
        <div className="mt-8 flex justify-center">
          <Button asChild className="h-11 rounded-xl px-5 text-sm">
            <Link href="/signup">Sign up <ArrowRight className="size-4" /></Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function ProductFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_80px_oklch(0.45_0.012_255_/_0.14)]", className)}>
      <div className="flex items-center gap-2 border-b border-border bg-[oklch(0.965_0.005_255)] px-4 py-3">
        <span className="size-2.5 rounded-full bg-[oklch(0.72_0.04_28)]" />
        <span className="size-2.5 rounded-full bg-[oklch(0.78_0.07_78)]" />
        <span className="size-2.5 rounded-full bg-[oklch(0.68_0.09_155)]" />
        <span className="ml-3 text-xs text-muted-foreground">CRMe workspace</span>
      </div>
      {children}
    </div>
  );
}

function HeroProductMock() {
  const [view, setView] = useState<"dashboard" | "suggestions">("suggestions");

  useEffect(() => {
    const interval = window.setInterval(() => {
      setView((current) => current === "suggestions" ? "dashboard" : "suggestions");
    }, 3000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="grid min-h-[460px] bg-background text-sm md:grid-cols-[150px_minmax(0,1fr)] lg:min-h-[520px]">
      <aside className="hidden border-r border-border bg-[oklch(0.966_0.005_255)] p-4 md:block">
        <BrandMark size="xs" />
        <div className="mt-6 space-y-1 text-muted-foreground">
          {['Dashboard', 'People', 'Companies', 'Tasks', 'Suggestions'].map((item) => (
            <div key={item} className={cn("rounded-xl px-3 py-2 transition-colors duration-300", item.toLowerCase() === view && "bg-primary text-primary-foreground")}>{item}</div>
          ))}
        </div>
      </aside>
      <div className="h-[430px] min-w-0 overflow-hidden p-4 sm:p-5 lg:h-[490px]">
        <div key={view} className="h-full animate-[landing_mock_fade_600ms_cubic-bezier(0.16,1,0.3,1)]">
          {view === "suggestions" ? <SuggestionsMock /> : <DashboardMock />}
        </div>
      </div>
    </div>
  );
}

function SuggestionsMock() {
  return (
    <>
      <div>
        <h3 className="text-xl font-semibold tracking-[-0.04em]">Review suggested changes</h3>
        <p className="mt-1 text-muted-foreground">Prepared from notes, calls, and imported context.</p>
      </div>
      <div className="mt-5 rounded-2xl border border-border bg-[oklch(0.974_0.006_255)] p-4">
        <div className="flex items-center gap-2 font-medium tracking-[-0.02em]"><Sparkles className="size-4" /> Agent note</div>
        <p className="mt-2 text-muted-foreground">No record is created until you approve it.</p>
      </div>
      <div className="mt-5 space-y-3">
        {approvalItems.map((item) => (
          <div key={item.title} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <StatusBadge value={item.kind} tone="blue" />
                  <span className="text-xs text-muted-foreground">Ready for review</span>
                  <span className="text-xs text-muted-foreground">{item.lastTouch}</span>
                </div>
                <h4 className="mt-3 font-medium tracking-[-0.02em]">{item.title}</h4>
                <p className="mt-1 leading-6 text-muted-foreground">{item.body}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background">Edit</Button>
                <Button size="sm" className="h-8 rounded-xl">Approve</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function DashboardMock() {
  const nowTasks = [
    { title: "Send implementation notes to Maya", meta: "Northstar Health · due today", priority: "high" },
    { title: "Confirm pilot timeline", meta: "Northstar pilot · overdue", priority: "urgent" },
  ];
  const nextTasks = [
    { title: "Share security answers", meta: "Maya Chen · tomorrow" },
    { title: "Prepare pricing follow-up", meta: "Northstar Health · May 18" },
  ];

  return (
    <div className="relative h-full space-y-4 overflow-hidden bg-[oklch(0.985_0.003_255)] pb-12">
      <section className="min-w-0 overflow-hidden rounded-xl border bg-background">
        <div className="flex flex-col gap-3 border-b bg-[oklch(0.965_0.008_255)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-[-0.02em]">Act next</h3>
            <p className="mt-1 text-xs text-muted-foreground">Urgent work first, then the rest of the queue.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-background px-2.5 py-1 ring-1 ring-border">2 urgent or high</span>
            <span className="rounded-full bg-background px-2.5 py-1 ring-1 ring-border">4 open</span>
            <Button variant="outline" className="h-8 rounded-xl bg-background px-3 text-xs">All tasks</Button>
          </div>
        </div>
        <div className="border-b">
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3.5">
            <div className="flex items-baseline gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[oklch(0.38_0.08_45)]">Now</h4>
              <span className="text-xs text-[oklch(0.46_0.055_58)]">urgent, overdue, or due today</span>
            </div>
            <span className="text-xs tabular-nums text-[oklch(0.46_0.055_58)]">2</span>
          </div>
          <div className="divide-y divide-[oklch(0.88_0.025_58)] border-t border-[oklch(0.88_0.025_58)]">
            {nowTasks.map((task) => <DashboardTaskMock key={task.title} {...task} emphasized />)}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3.5">
            <div className="flex items-baseline gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Next</h4>
              <span className="text-xs text-muted-foreground">remaining open tasks</span>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">2</span>
          </div>
          <div className="divide-y border-t">
            {nextTasks.map((task) => <DashboardTaskMock key={task.title} {...task} />)}
          </div>
        </div>
      </section>

      <aside className="min-w-0 overflow-hidden rounded-xl border bg-background">
        <div className="flex items-center justify-between gap-3 border-b bg-[oklch(0.965_0.008_255)] px-5 py-4">
          <div>
            <h3 className="text-base font-semibold tracking-[-0.02em]">Recommendations</h3>
            <p className="mt-1 text-xs text-muted-foreground">Suggested updates and follow-ups.</p>
          </div>
          <Button variant="outline" className="h-8 rounded-xl bg-background px-3 text-xs">All suggestions</Button>
        </div>
        <div className="grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
          {[
            { label: "New companies", count: 1, description: "Companies found from activity that may belong in CRMe.", latest: "today" },
            { label: "New people", count: 1, description: "People found from activity that may belong in CRMe.", latest: "today" },
            { label: "Deal stage nudges", count: 1, description: "Suggested CRM updates waiting for review.", latest: "yesterday" },
          ].map((group) => (
            <div key={group.label} className="block min-w-0 px-5 py-4 text-left">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-sm font-medium tracking-[-0.01em]">{group.label}</div>
                <div className="text-lg font-semibold tabular-nums tracking-[-0.035em]">{group.count}</div>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{group.description}</p>
              <div className="mt-3 text-xs text-muted-foreground">Latest {group.latest}</div>
            </div>
          ))}
        </div>
      </aside>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[oklch(0.985_0.003_255)]" />
    </div>
  );
}

function DashboardTaskMock({ title, meta, priority, emphasized }: { title: string; meta: string; priority?: string; emphasized?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-5 py-3", emphasized && "bg-[oklch(0.985_0.012_58)]")}>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium tracking-[-0.01em]">{title}</div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{meta}</div>
      </div>
      {priority && <StatusBadge value={priority} tone="amber" />}
    </div>
  );
}

function AgentBuilder() {
  return (
    <div className="flex min-h-[500px] flex-col overflow-hidden bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageSquareText className="size-4" /> Assistant</h3>
          <p className="text-xs text-muted-foreground">Recent conversations saved</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 rounded-xl bg-background"><History className="size-3.5" /> History</Button>
          <Button variant="outline" size="sm" className="h-8 rounded-xl bg-background">New</Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-4">
        <div className="space-y-1.5 text-sm leading-6">
          <div className="ml-6 rounded-2xl bg-[oklch(0.19_0.006_255)] p-3 text-[oklch(0.985_0.004_255)]">
            Add a deal for the Northstar pilot. Maya Chen at Northstar Health, $18k, proposal stage.
          </div>
          <div className="border-b border-border/70 py-3 text-foreground">
            <p>I do not see Northstar Health or Maya Chen in CRMe yet. I can create the company first.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" className="h-8 rounded-xl">Confirm</Button>
              <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl bg-background">Cancel</Button>
            </div>
          </div>
          <AssistantStatusPill label="Confirmed" />
          <AssistantMockEntity type="Company" title="Northstar Health" subtitle="northstar.health" />
          <div className="border-b border-border/70 py-3 text-foreground">
            <p>Company created. Next I can create Maya Chen and link her to Northstar Health.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" className="h-8 rounded-xl">Confirm</Button>
              <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl bg-background">Cancel</Button>
            </div>
          </div>
          <AssistantStatusPill label="Confirmed" />
          <AssistantMockEntity type="Person" title="Maya Chen" subtitle="Founder · Northstar Health" />
          <div className="border-b border-border/70 py-3 text-foreground">
            <p>Person created. Last step: create the deal and link it to Maya Chen and Northstar Health.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" className="h-8 rounded-xl">Confirm</Button>
              <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl bg-background">Cancel</Button>
            </div>
          </div>
          <AssistantMockEntity type="Deal" title="Northstar pilot" subtitle="$18,000 · proposal" />
        </div>
      </div>
      <div className="border-t p-3">
        <div className="flex h-10 items-center rounded-xl border border-input bg-background px-3 text-sm text-muted-foreground">Ask CRMe...</div>
      </div>
    </div>
  );
}

function AssistantStatusPill({ label }: { label: string }) {
  return (
    <div className="flex justify-end py-1">
      <div className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function AssistantMockEntity({ type, title, subtitle }: { type: string; title: string; subtitle: string }) {
  return (
    <div className="block w-full max-w-full overflow-hidden border-b border-border/70 py-2.5 text-left text-sm last:border-b-0">
      <div className="grid min-w-0 grid-cols-[4.5rem_1fr_auto] items-start gap-3 px-1">
        <div className="text-xs text-muted-foreground">{type}</div>
        <div className="min-w-0">
          <div className="line-clamp-2 break-words font-medium leading-5 text-foreground">{title}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <LinkIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      </div>
    </div>
  );
}

function SuggestionApprovalMock() {
  const items = [
    { kind: "new company", title: "Acorn Robotics", body: "From jamie@acorn.example · Subject: Partner intro", lastTouch: "Last touch today", action: "Create company" },
    { kind: "new contact", title: "Jamie Park", body: "jamie@acorn.example · Founder at Acorn Robotics", lastTouch: "Last touch today", action: "Create contact" },
    { kind: "follow up", title: "Call back Priya", body: "Custom call activity · Mentioned budget approval next week", lastTouch: "Last touch yesterday", action: "Approve" },
  ];

  return (
    <div className="min-h-[500px] bg-background p-4 sm:p-5">
      <div className="rounded-2xl border border-border bg-[oklch(0.974_0.006_255)] p-4">
        <div className="flex items-center gap-2 font-medium tracking-[-0.02em]"><Sparkles className="size-4" /> Agent note</div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">These are prepared changes. Review each suggestion, link it to an existing record when needed, then approve only what should become part of your CRM.</p>
      </div>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <StatusBadge value={item.kind} tone="blue" />
                  <span className="text-xs text-muted-foreground">Ready for review</span>
                  <span className="text-xs text-muted-foreground">{item.lastTouch}</span>
                </div>
                <h4 className="text-base font-medium tracking-[-0.02em]">{item.title}</h4>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{item.body}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                {item.kind !== "follow up" && <Button size="sm" variant="outline" className="h-8 rounded-xl bg-background">Link existing</Button>}
                <Button size="sm" className="h-8 rounded-xl">{item.action}</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProofLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <Check className="size-4 shrink-0 text-[oklch(0.52_0.12_155)]" />
      <span>{children}</span>
    </div>
  );
}

function LinkedInExtensionMock() {
  const [captureState, setCaptureState] = useState<"ready" | "saving" | "saved">("ready");
  const [hasPlayed, setHasPlayed] = useState(false);
  const mockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = mockRef.current;
    if (!element || hasPlayed) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setHasPlayed(true);
      window.setTimeout(() => setCaptureState("saving"), 2000);
      window.setTimeout(() => setCaptureState("saved"), 2850);
      observer.disconnect();
    }, { threshold: 0.45 });

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasPlayed]);

  return (
    <div ref={mockRef} className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_72px_340px] lg:items-center">
      <div className="relative overflow-hidden rounded-3xl border border-[oklch(0.88_0.008_255)] bg-[oklch(0.985_0.003_255)] shadow-[0_24px_80px_oklch(0.45_0.012_255_/_0.14)]">
        <div className="flex items-center gap-2 border-b border-[oklch(0.88_0.008_255)] bg-[oklch(0.96_0.004_255)] px-5 py-3 text-sm text-muted-foreground">
          <span className="size-2.5 rounded-full bg-[oklch(0.62_0.16_255)]" />
          linkedin.com/in/maya-chen
        </div>
        <div className="min-h-[610px] bg-[oklch(0.94_0.005_255)] p-6">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-[oklch(0.87_0.008_255)] bg-card shadow-sm">
            <div className="h-40 bg-[linear-gradient(135deg,oklch(0.78_0.08_255),oklch(0.88_0.035_210))]" />
            <div className="px-8 pb-8">
              <div className="-mt-14 flex size-28 items-center justify-center rounded-full border-4 border-card bg-[oklch(0.82_0.03_255)] text-3xl font-semibold">MC</div>
              <h3 className="mt-4 text-3xl font-semibold tracking-[-0.045em]">Maya Chen</h3>
              <p className="mt-2 text-base text-foreground">Founder at Northstar Health</p>
              <p className="mt-1 text-sm text-muted-foreground">San Francisco, California · 8,214 followers</p>
              <div className="mt-6 flex gap-2">
                <span className="rounded-full bg-[oklch(0.58_0.14_255)] px-4 py-1.5 text-sm font-medium text-[oklch(0.985_0.004_255)]">Connect</span>
                <span className="rounded-full border border-[oklch(0.58_0.14_255)] px-4 py-1.5 text-sm font-medium text-[oklch(0.48_0.12_255)]">Message</span>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-4 grid max-w-3xl gap-4 md:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-xl border border-[oklch(0.87_0.008_255)] bg-card p-5 shadow-sm">
              <div className="font-medium text-foreground">Experience</div>
              <div className="mt-4 border-b border-border pb-4">
                <p className="text-sm font-medium text-foreground">Northstar Health · Founder</p>
                <p className="mt-1 text-xs text-muted-foreground">2024-present · San Francisco</p>
              </div>
              <div className="pt-4 pb-6">
                <p className="text-sm font-medium text-foreground">Meridian Ventures · Board advisor</p>
                <p className="mt-1 text-xs text-muted-foreground">2023-present · Remote</p>
              </div>
            </div>
            <div className="rounded-xl border border-[oklch(0.87_0.008_255)] bg-card p-5 shadow-sm">
              <div className="font-medium text-foreground">About</div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Building care operations software for regional clinics.</p>
            </div>
          </div>
        </div>
        <div className="absolute bottom-6 left-8">
          <div className="flex items-stretch rounded-[24px] shadow-[0_6px_16px_oklch(0.2_0.006_255_/_0.22)]">
            <button className={cn(
              "flex h-12 min-w-32 items-center gap-2 rounded-l-[24px] px-5 text-sm font-semibold text-[oklch(0.985_0.004_255)] transition-colors duration-300",
              captureState === "saved" ? "bg-[oklch(0.42_0.1_155)]" : captureState === "saving" ? "bg-[oklch(0.55_0.11_78)]" : "bg-[oklch(0.19_0.006_255)]",
            )}>
              {captureState === "saved" ? <Check className="size-4" /> : <span>{captureState === "saving" ? "◌" : "+"}</span>}
              <span>{captureState === "saved" ? "View in CRME" : captureState === "saving" ? "Saving..." : "Add to CRME"}</span>
            </button>
            <button className={cn(
              "h-12 rounded-r-[24px] border-l border-[oklch(0.985_0.004_255_/_0.25)] px-3 text-xs font-bold tracking-[0.08em] text-[oklch(0.985_0.004_255)] transition-colors duration-300",
              captureState === "saved" ? "bg-[oklch(0.34_0.1_155)]" : "bg-[oklch(0.25_0.006_255)]",
            )}>•••</button>
          </div>
        </div>
      </div>
      <div className="hidden justify-center lg:flex">
        <div className="flex size-12 items-center justify-center rounded-full border border-border bg-card shadow-sm">
          <MoveRight className="size-5 text-muted-foreground" />
        </div>
      </div>
      <div className="rounded-3xl border border-border bg-[oklch(0.976_0.004_255)] p-5 shadow-[0_18px_60px_oklch(0.45_0.012_255_/_0.12)]">
          <div className="text-sm font-medium tracking-[-0.02em]">Created in CRMe</div>
          <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <StatusBadge value="new contact" tone="blue" />
            <h4 className="mt-3 font-medium tracking-[-0.02em]">Maya Chen</h4>
            <p className="mt-1 text-sm text-muted-foreground">Founder at Northstar Health</p>
          </div>
          <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <StatusBadge value="new company" tone="blue" />
            <h4 className="mt-3 font-medium tracking-[-0.02em]">Northstar Health</h4>
            <p className="mt-1 text-sm text-muted-foreground">Current company from LinkedIn</p>
          </div>
          <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <StatusBadge value="new company" tone="blue" />
            <h4 className="mt-3 font-medium tracking-[-0.02em]">Meridian Ventures</h4>
            <p className="mt-1 text-sm text-muted-foreground">Current company from LinkedIn</p>
          </div>
        </div>
    </div>
  );
}

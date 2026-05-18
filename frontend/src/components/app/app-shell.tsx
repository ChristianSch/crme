"use client";

import { ReactNode } from "react";

import { SidebarNav } from "@/components/app/sidebar-nav";

export function AppShell({
  title,
  description,
  sidebarCollapsed,
  onSidebarCollapsedChange,
  controls,
  headerActions,
  children,
}: {
  title: string;
  description: string;
  sidebarCollapsed: boolean;
  onSidebarCollapsedChange: (collapsed: boolean) => void;
  controls?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <SidebarNav collapsed={sidebarCollapsed} onCollapsedChange={onSidebarCollapsedChange} />
        <section className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1720px] px-4 py-5 pl-16 sm:px-8 lg:px-12">
            <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-[-0.035em]">
                  <span className="relative inline" style={{ zIndex: 0 }}>
                    {title}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute rounded-full"
                      style={{
                        bottom: "2px",
                        left: "-4px",
                        right: "-4px",
                        height: "8px",
                        background: "oklch(0.9 0.04 55)",
                        zIndex: -1,
                      }}
                    />
                  </span>
                </h1>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              {headerActions && <div className="shrink-0 lg:pt-1">{headerActions}</div>}
            </header>

            {controls && (
              <div className="mt-7 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                {controls}
              </div>
            )}

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

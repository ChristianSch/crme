"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarClock, Circle, LayoutDashboard, Lightbulb, Menu, PanelLeftClose, PanelLeftOpen, Settings, UserRound } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type AppView = "dashboard" | "companies" | "people" | "deals" | "tasks" | "suggestions" | "settings";

type NavItem = { view: AppView; href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const primaryNavItems: NavItem[] = [
  { view: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "people", href: "/people", label: "People", icon: UserRound },
  { view: "companies", href: "/companies", label: "Companies", icon: Building2 },
  { view: "deals", href: "/deals", label: "Deals", icon: Circle },
  { view: "tasks", href: "/tasks", label: "Tasks", icon: CalendarClock },
  { view: "suggestions", href: "/suggestions", label: "Suggestions", icon: Lightbulb },
];

const secondaryNavItems: NavItem[] = [
  { view: "settings", href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav({ collapsed, onCollapsedChange }: { collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void }) {
  return (
    <>
      <div className="fixed left-4 top-4 z-50 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="size-10 rounded-xl bg-background shadow-sm" aria-label="Open navigation">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent collapsed={false} />
          </SheetContent>
        </Sheet>
      </div>

      <aside className={cn("hidden shrink-0 flex-col transition-[width] duration-200 lg:flex", collapsed ? "w-[76px]" : "w-64")}>
        <div className="sticky top-0 flex h-screen flex-col border-r border-sidebar-border bg-sidebar p-3">
          <SidebarContent collapsed={collapsed} onCollapsedChange={onCollapsedChange} />
        </div>
      </aside>
    </>
  );
}

function SidebarContent({ collapsed, onCollapsedChange }: { collapsed: boolean; onCollapsedChange?: (collapsed: boolean) => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-[oklch(0.986_0.004_255)] p-3 lg:bg-transparent lg:p-0">
      <div className={cn("flex items-center gap-3 px-2 py-2", collapsed && "justify-center px-0")}>
        <Avatar className="size-9" aria-hidden="true">
          <AvatarFallback className="text-xs font-medium">C</AvatarFallback>
        </Avatar>
        {!collapsed && <div className="min-w-0"><BrandMark size="xs" /><div className="text-xs text-muted-foreground">Your ClientOS</div></div>}
      </div>

      <nav className="mt-5 space-y-1">
        {primaryNavItems.map((item) => <NavLink key={item.href} item={item} active={pathname === item.href} collapsed={collapsed} />)}
      </nav>

      <nav className="mt-auto space-y-1 border-t border-sidebar-border pt-3">
        {secondaryNavItems.map((item) => <NavLink key={item.href} item={item} active={pathname === item.href} collapsed={collapsed} />)}
      </nav>

      {onCollapsedChange && (
        <div className="pt-2">
          <Button variant="ghost" size={collapsed ? "icon" : "sm"} className={cn("h-10 w-full rounded-xl", !collapsed && "justify-start gap-2")} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={() => onCollapsedChange(!collapsed)}>
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && "Collapse"}
          </Button>
        </div>
      )}
    </div>
  );
}

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

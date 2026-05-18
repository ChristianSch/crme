"use client";

import { Building2 } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Workspace } from "@/lib/api";

export function WorkspaceFilter({
  value,
  workspaces,
  onChange,
}: {
  value: string;
  workspaces: Workspace[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-full rounded-xl bg-background shadow-none md:w-[230px]">
        <div className="flex items-center gap-2 truncate">
          <Building2 className="size-4 text-muted-foreground" />
          <SelectValue placeholder="Workspace" />
        </div>
      </SelectTrigger>
      <SelectContent align="start" position="popper" className="min-w-[var(--radix-select-trigger-width)] rounded-xl p-1">
        <SelectItem value="all" className="rounded-lg py-2 pl-3 pr-8">All workspaces</SelectItem>
        {workspaces.map((workspace) => (
          <SelectItem key={workspace.id} value={workspace.id} className="rounded-lg py-2 pl-3 pr-8">
            {workspace.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

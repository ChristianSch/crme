"use client";

import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/data-state";
import { RowMenu } from "@/components/common/row-menu";
import { StatusBadge } from "@/components/common/status-badge";
import { Company } from "@/lib/api";
import { initials, relativeDate, shortDate, type SortDirection } from "@/lib/format";

export function CompaniesTable({
  companies,
  lastTouchSort,
  onSortLastTouch,
  onSelect,
}: {
  companies: Company[];
  lastTouchSort: SortDirection;
  onSortLastTouch: () => void;
  onSelect: (company: Company) => void;
}) {
  if (!companies.length) return <EmptyState title="No companies found" body="Try another workspace or search term." />;

  return (
    <Table className="min-w-[820px]">
      <TableHeader>
        <TableRow className="bg-[oklch(0.975_0.004_255)] hover:bg-[oklch(0.975_0.004_255)]">
          <TableHead className="w-[38%] pl-7">Company <ChevronDown className="ml-1 inline size-3" /></TableHead>
          <TableHead>Domain</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>
            <button type="button" onClick={onSortLastTouch} className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted">
              Last touch {lastTouchSort === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
            </button>
          </TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {companies.map((company) => (
          <TableRow key={company.id} className="h-[72px] cursor-pointer" onClick={() => onSelect(company)}>
            <TableCell className="pl-7">
              <div className="flex items-center gap-3">
                <Avatar className="size-10 rounded-xl border bg-muted">
                  <AvatarFallback className="rounded-xl text-xs font-medium">{initials(company.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium leading-none">{company.name || "Unnamed company"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Created {shortDate(company.created_at)}</div>
                </div>
              </div>
            </TableCell>
            <TableCell>{company.domain || "No domain"}</TableCell>
            <TableCell><StatusBadge value="Tracked" tone="blue" /></TableCell>
            <TableCell className="text-muted-foreground">{relativeDate(company.last_touch_at)}</TableCell>
            <TableCell><RowMenu /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}


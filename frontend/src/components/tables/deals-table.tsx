"use client";

import { ChevronDown } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/data-state";
import { RowMenu } from "@/components/common/row-menu";
import { StatusBadge } from "@/components/common/status-badge";
import { Deal } from "@/lib/api";
import { formatMoney, relativeDate, shortDate } from "@/lib/format";

export function DealsTable({ deals, onSelect }: { deals: Deal[]; onSelect: (deal: Deal) => void }) {
  if (!deals.length) return <EmptyState title="No deals found" body="Deals linked to the selected workspace will show here." />;

  return (
    <Table className="min-w-[760px]">
      <TableHeader>
        <TableRow className="bg-[oklch(0.975_0.004_255)] hover:bg-[oklch(0.975_0.004_255)]">
          <TableHead className="w-[42%] pl-7">Deal <ChevronDown className="ml-1 inline size-3" /></TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {deals.map((deal) => (
          <TableRow key={deal.id} className="h-[72px] cursor-pointer" onClick={() => onSelect(deal)}>
            <TableCell className="pl-7">
              <div className="font-medium leading-none">{deal.name || "Unnamed deal"}</div>
              <div className="mt-1 text-xs text-muted-foreground">Created {shortDate(deal.created_at)}</div>
            </TableCell>
            <TableCell><StatusBadge value={deal.stage || "new"} tone="blue" /></TableCell>
            <TableCell>{formatMoney(deal.value_cents, deal.currency)}</TableCell>
            <TableCell className="text-muted-foreground">{relativeDate(deal.updated_at)}</TableCell>
            <TableCell><RowMenu /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}


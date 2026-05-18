"use client";

import { ArrowDown, ArrowUp, ChevronDown, ExternalLink } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/data-state";
import { RowMenu } from "@/components/common/row-menu";
import { StatusBadge } from "@/components/common/status-badge";
import { fullName, Person } from "@/lib/api";
import { initials, relativeDate, type SortDirection } from "@/lib/format";

export function PeopleTable({
  people,
  lastTouchSort,
  onSortLastTouch,
  onSelect,
}: {
  people: Person[];
  lastTouchSort: SortDirection;
  onSortLastTouch: () => void;
  onSelect: (person: Person) => void;
}) {
  if (!people.length) return <EmptyState title="No people found" body="Try another workspace or search term." />;

  return (
    <Table className="min-w-[980px]">
      <TableHeader>
        <TableRow className="bg-[oklch(0.975_0.004_255)] hover:bg-[oklch(0.975_0.004_255)]">
          <TableHead className="w-[34%] pl-7">Person <ChevronDown className="ml-1 inline size-3" /></TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Attention</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>
            <button type="button" onClick={onSortLastTouch} className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted">
              Last touch {lastTouchSort === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
            </button>
          </TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.map((person) => (
          <TableRow key={person.id} className="h-[72px] cursor-pointer" onClick={() => onSelect(person)}>
            <TableCell className="pl-7">
              <div className="flex items-center gap-3">
                <Avatar className="size-10 rounded-xl border bg-muted">
                  <AvatarFallback className="rounded-xl text-xs font-medium">{initials(fullName(person))}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5 font-medium leading-none">
                    {fullName(person)} <ExternalLink className="size-3 text-muted-foreground" />
                  </div>
                  <PersonSubtitle person={person} />
                </div>
              </div>
            </TableCell>
            <TableCell><StatusBadge value={person.status || "Active"} tone="green" /></TableCell>
            <TableCell>{person.my_turn ? <StatusBadge value="My turn" tone="amber" /> : <span className="text-muted-foreground">Clear</span>}</TableCell>
            <TableCell className="text-muted-foreground">{person.title || "No title"}</TableCell>
            <TableCell>{person.email || "No email"}</TableCell>
            <TableCell className="text-muted-foreground">{relativeDate(person.last_touch_at)}</TableCell>
            <TableCell><RowMenu /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PersonSubtitle({ person }: { person: Person }) {
  const details = [person.company_name, person.city].filter(Boolean);
  if (!details.length) return null;
  return <div className="mt-1 text-xs text-muted-foreground">{details.join(" · ")}</div>;
}


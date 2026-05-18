import { Company, Deal, Person, Todo } from "@/lib/api";

export type SortDirection = "asc" | "desc";

export function searchable(values: Array<string | undefined | null>, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => (value ?? "").toLowerCase().includes(normalized));
}

export function initials(value: string) {
  const parts = value.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function toggleSort(value: SortDirection): SortDirection {
  return value === "desc" ? "asc" : "desc";
}

export function compareDates(a: string | undefined, b: string | undefined, direction: SortDirection) {
  const av = a ? new Date(a).getTime() : 0;
  const bv = b ? new Date(b).getTime() : 0;
  return direction === "desc" ? bv - av : av - bv;
}

export function formatMoney(valueCents: number, currency = "USD") {
  const amount = valueCents / 100;
  const normalizedCurrency = /^[A-Z]{3}$/.test(currency) ? currency : "";
  if (!normalizedCurrency) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: normalizedCurrency }).format(amount);
}

export function relativeDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  const diff = date.getTime() - Date.now();
  const days = Math.round(diff / 86400000);
  if (Math.abs(days) < 1) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (Math.abs(days) < 7) return `${Math.abs(days)}d ${days > 0 ? "from now" : "ago"}`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

export function shortDate(value?: string) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function firstUsefulLine(value: string) {
  return value.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
}

export function linkedEntityLabel(task: Todo, people: Person[], companies: Company[], deals: Deal[] = []) {
  if (task.entity_type === "person") {
    const person = people.find((item) => item.id === task.entity_id);
    if (!person) return "Unknown person";
    return [person.first_name, person.last_name].filter(Boolean).join(" ") || person.email || "Unnamed person";
  }
  if (task.entity_type === "company") {
    const company = companies.find((item) => item.id === task.entity_id);
    if (!company) return "Unknown company";
    return company.name || company.domain || "Unnamed company";
  }
  if (task.entity_type === "deal") {
    const deal = deals.find((item) => item.id === task.entity_id);
    if (!deal) return "Unknown deal";
    return deal.name || "Unnamed deal";
  }
  return "Unlinked";
}

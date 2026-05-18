import { Input } from "@/components/ui/input";

export function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <h3 className="flex items-center gap-2 text-sm font-semibold tracking-[-0.015em]">{icon}{title}</h3>;
}

export function PersonField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input value={value || ""} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl bg-background" />
    </label>
  );
}

export function Detail({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 border-b py-2 first:pt-0 last:border-b-0 last:pb-0">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-medium">{children ?? value}</div>
    </div>
  );
}

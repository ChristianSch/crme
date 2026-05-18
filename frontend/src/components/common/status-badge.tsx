import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ value, tone }: { value: string; tone: "green" | "amber" | "blue" }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
        tone === "green" && "bg-[oklch(0.93_0.035_150)] text-[oklch(0.35_0.08_150)]",
        tone === "amber" && "bg-[oklch(0.91_0.065_58)] text-[oklch(0.36_0.075_45)]",
        tone === "blue" && "bg-[oklch(0.93_0.035_245)] text-[oklch(0.38_0.08_245)]",
      )}
    >
      {value}
    </Badge>
  );
}

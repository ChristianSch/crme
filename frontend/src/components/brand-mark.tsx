import { cn } from "@/lib/utils";

export function BrandMark({ size = "sm" }: { size?: "xs" | "sm" | "lg" }) {
  const className = size === "lg" ? "text-6xl sm:text-7xl" : size === "sm" ? "text-xl" : "text-base";

  return (
    <span className={cn("inline-flex items-baseline font-semibold tracking-[-0.08em] text-foreground", className)}>
      <span>CR</span>
      <span className="relative ml-[0.03em] inline-flex items-baseline">
        <span aria-hidden="true" className="absolute inset-x-[-0.1em] bottom-[0.08em] z-0 h-[0.42em] -rotate-1 rounded-[0.18em] bg-[oklch(0.74_0.16_48_/_0.82)]" />
        <span className="relative z-10">M</span>
        <span className="relative z-10 tracking-[-0.12em]">e</span>
      </span>
    </span>
  );
}

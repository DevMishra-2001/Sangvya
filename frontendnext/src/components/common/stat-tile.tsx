import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Number + label with a tinted icon; clickable when it filters the list below
export function StatTile({ icon: Icon, value, label, tone = "bg-primary/10 text-primary", active, onClick }: { icon: LucideIcon; value: React.ReactNode; label: string; tone?: string; active?: boolean; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? Boolean(active) : undefined}
      className={cn("flex items-center gap-3 rounded-xl border bg-card p-4 text-left", onClick && "transition-colors hover:border-primary/50", active && "border-primary ring-2 ring-primary/20")}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold tabular-nums">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </Tag>
  );
}

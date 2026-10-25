"use client";

import { STATUS_META, STATUS_ORDER, type TicketStatus } from "@/lib/constants";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type TicketFilter = "all" | TicketStatus;

// Chips: All (n) · Approved (n) · … — each with its color dot and count
export function StatusFilter({ value, onChange, counts, total }: { value: TicketFilter; onChange: (f: TicketFilter) => void; counts: Record<TicketStatus, number>; total: number }) {
  const options: { key: TicketFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: total },
    ...STATUS_ORDER.map((s) => ({ key: s as TicketFilter, label: STATUS_META[s].label, count: counts[s] ?? 0 })),
  ];
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(v) => v && onChange(v as TicketFilter)}
      aria-label="Filter tickets"
      className="flex-wrap"
    >
      {options.map((f) => (
        <ToggleGroupItem
          key={f.key}
          value={f.key}
          className="rounded-full bg-card text-xs text-muted-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {f.key !== "all" && <span className="size-2 rounded-full" style={{ background: STATUS_META[f.key].color }} />}
          {f.label} ({f.count})
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monthLabel, shiftMonth, toMonth } from "@/lib/format";

// "YYYY-MM" picker: previous / next month, can't go past the current month
export function MonthPicker({ value, onChange, allowFuture = false }: { value: string; onChange: (month: string) => void; allowFuture?: boolean }) {
  const atCurrent = value >= toMonth(new Date());
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-background p-0.5">
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(shiftMonth(value, -1))} aria-label="Previous month">
        <ChevronLeft />
      </Button>
      <span className="min-w-24 text-center text-sm font-medium tabular-nums">{monthLabel(value)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onChange(shiftMonth(value, 1))}
        disabled={!allowFuture && atCurrent}
        aria-label="Next month"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

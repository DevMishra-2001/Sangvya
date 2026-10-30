"use client";

import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { run } from "@/lib/api/run";
import { isoDate } from "@/lib/format";
import { holidaysService } from "@/lib/services/holidays";
import type { Holiday } from "@/lib/types";
import { cn } from "@/lib/utils";
import { YearSwitch } from "./holidays-view";

const parts = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return { day: d.getDate(), month: d.toLocaleDateString("en-IN", { month: "short" }), weekday: d.toLocaleDateString("en-IN", { weekday: "long" }) };
};

// Everyone: the company's holidays for a year, and the weekly offs
export function MyHolidaysView() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [data, setData] = useState<{ year: number; holidays: Holiday[]; weeklyOffs: string[] } | null>(null);
  const today = isoDate(new Date());

  useEffect(() => {
    run(() => holidaysService.list(year)).then((r) => r.ok && setData({ year, ...r.data }));
  }, [year]);

  const current = data?.year === year ? data : null;
  const next = current?.holidays.find((h) => h.date >= today && !h.is_optional);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Holidays"
        description={
          current?.weeklyOffs.length
            ? `Weekly offs: ${current.weeklyOffs.join(", ")}. Optional holidays are working days — take one with your OL if you like.`
            : "Optional holidays are working days — take one with your OL if you like."
        }
        className="mb-0"
        actions={<YearSwitch year={year} onChange={setYear} />}
      />
      {!current ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : current.holidays.length === 0 ? (
        <EmptyState icon={PartyPopper} title={`No holidays for ${year} yet`} description="Your HR team adds them." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {current.holidays.map((h) => {
            const p = parts(h.date);
            const past = h.date < today;
            return (
              <li
                key={h.id}
                className={cn("flex items-center gap-3 rounded-xl border bg-card p-3", past && "opacity-55", h.id === next?.id && "border-primary ring-2 ring-primary/20")}
              >
                <span className={cn("flex size-12 shrink-0 flex-col items-center justify-center rounded-lg", h.is_optional ? "bg-muted" : "bg-info/15 text-info")}>
                  <span className="text-lg leading-none font-bold tabular-nums">{p.day}</span>
                  <span className="text-[10px] font-semibold uppercase">{p.month}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{h.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.weekday}</span>
                </span>
                {h.is_optional ? <Badge variant="outline">Optional</Badge> : h.id === next?.id ? <Badge>Next</Badge> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

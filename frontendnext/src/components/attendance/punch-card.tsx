"use client";

import { useEffect, useState } from "react";
import { CheckInButton } from "./check-in-dialog";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMinutes, fmtTime, liveTotals } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSelfStore } from "@/stores/self-store";

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-semibold tabular-nums", warn && "text-destructive")}>{value}</div>
    </div>
  );
}

// Today's punches with a live running total. Punch out = break starts; punching
// in again the same day ends the break. The day ends at the last punch-out.
export function PunchCard() {
  const today = useSelfStore((s) => s.today);
  const loadToday = useSelfStore((s) => s.loadToday);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  if (!today) return <Skeleton className="h-36 w-full rounded-xl" />;

  const { day, rules, holiday, isSunday } = today;
  const totals = liveTotals(day, now);
  const punchedIn = Boolean(day?.punchIn);
  const punchedOut = Boolean(day?.punchOut);
  const remaining = Math.max(0, rules.requiredMinutes - totals.totalMinutes);

  let statusText = "Not punched in yet";
  if (punchedOut) statusText = `Punched out at ${fmtTime(day?.punchOut)} — punch in again to continue (the time away counts as a break)`;
  else if (punchedIn) statusText = "Working";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s attendance</CardTitle>
        <CardDescription>
          {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · {statusText}
          {holiday && <span className="text-primary"> · Holiday: {holiday.name}</span>}
          {isSunday && !holiday && <span className="text-primary"> · Sunday</span>}
        </CardDescription>
        <CardAction>
          <CheckInButton />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Stat label="First punch in" value={fmtTime(day?.punchIn)} />
          <Stat label="Last punch out" value={fmtTime(day?.punchOut)} />
          <Stat label={`Break${day?.breaks.length ? ` (${day.breaks.length})` : ""}`} value={fmtMinutes(totals.breakMinutes)} warn={totals.breakMinutes > rules.maxBreakMinutes} />
          <Stat label="Total" value={fmtMinutes(totals.totalMinutes)} warn={punchedOut && totals.totalMinutes < rules.requiredMinutes} />
          <Stat label={punchedOut ? "Required" : "Remaining"} value={fmtMinutes(punchedOut ? rules.requiredMinutes : remaining)} />
        </div>
        {totals.breakMinutes > rules.maxBreakMinutes && (
          <p className="mt-3 text-xs text-destructive">Break limit of {fmtMinutes(rules.maxBreakMinutes)} exceeded — your manager will be notified by email.</p>
        )}
      </CardContent>
    </Card>
  );
}

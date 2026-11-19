"use client";

// F&F helper: suggests salary due, leave encashment and notice recovery; "Use these amounts" fills the form
import { useEffect, useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { run } from "@/lib/api/run";
import { fmtDate, inr } from "@/lib/format";
import { exitsService, type SettlementEstimate } from "@/lib/services/exits";
import type { Id } from "@/lib/types";

const DEFAULT_NOTICE_DAYS = 30;
const round = (n: number) => Math.round(n);

export function SettlementCalculator({ employeeId, onUse }: { employeeId: Id; onUse: (amounts: { lastSalary: number; leaveEncashment: number; noticeRecovery: number }) => void }) {
  const [est, setEst] = useState<SettlementEstimate | null>(null);
  const [open, setOpen] = useState(false);
  const [encash, setEncash] = useState<Record<string, boolean>>({});
  const [noticeDays, setNoticeDays] = useState(String(DEFAULT_NOTICE_DAYS));

  // Loaded only when HR opens the calculator
  useEffect(() => {
    if (!open || est) return;
    let cancelled = false;
    run(() => exitsService.estimate(employeeId)).then((r) => {
      if (cancelled) return;
      if (!r.ok) return setOpen(false);
      setEst(r.data);
      // Earned leave is the one usually paid out; others start unticked
      setEncash(Object.fromEntries(r.data.leave.map((l) => [l.type, l.type === "el"])));
    });
    return () => {
      cancelled = true;
    };
  }, [open, est, employeeId]);

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="mb-3" onClick={() => setOpen(true)}>
        <Calculator /> Auto-calculate F&amp;F
      </Button>
    );
  }
  if (!est) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
        <Spinner /> Working it out…
      </div>
    );
  }

  const encashDays = est.leave.reduce((t, l) => t + (encash[l.type] ? l.available : 0), 0);
  const leaveAmount = round(encashDays * est.perDay);
  const shortfall = est.notice.waived || est.notice.servedDays == null ? 0 : Math.max(0, (Number(noticeDays) || 0) - est.notice.servedDays);
  const recovery = round(shortfall * est.perDay);
  const salary = round(est.salary.total);

  return (
    <section className="mb-4 flex flex-col gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium">
          <Calculator className="size-4 text-primary" /> Suggested F&amp;F
        </p>
        <span className="text-xs text-muted-foreground">
          {est.monthlyGross ? `${inr(est.monthlyGross)}/month · ${inr(est.perDay)}/day` : "No salary on file"}
        </span>
      </div>
      {!est.monthlyGross && <p className="rounded-md bg-warning/10 px-2 py-1.5 text-xs">Add a salary structure (Payroll) or a salary on the profile to calculate amounts.</p>}

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Salary due</p>
        {est.salary.lines.length ? (
          est.salary.lines.map((l) => (
            <div key={l.label} className="flex justify-between">
              <span>
                {l.label} · {l.days}/{l.ofDays} days
              </span>
              <span className="tabular-nums">{inr(l.amount)}</span>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">{est.salary.exitMonthPaid ? "Already paid through payroll for the last month." : "Nothing due."}</p>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Leave encashment</p>
        {est.leave.length ? (
          <div className="flex flex-col gap-1">
            {est.leave.map((l) => (
              <label key={l.type} className="flex cursor-pointer items-center gap-2">
                <Checkbox checked={Boolean(encash[l.type])} onCheckedChange={(v) => setEncash((m) => ({ ...m, [l.type]: v === true }))} />
                <span className="flex-1">
                  {l.label} · {l.available} day{l.available === 1 ? "" : "s"} left
                </span>
                <span className="text-muted-foreground tabular-nums">{encash[l.type] ? inr(l.available * est.perDay) : "—"}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No leave balance left.</p>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Notice period</p>
        {est.notice.waived ? (
          <p className="text-muted-foreground">Terminated by the company — no notice recovery.</p>
        ) : est.notice.servedDays == null ? (
          <p className="text-muted-foreground">Notice start date unknown — enter recovery by hand.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span>Required</span>
            <Input type="number" min={0} max={365} value={noticeDays} onChange={(ev) => setNoticeDays(ev.target.value)} className="h-8 w-20" aria-label="Required notice days" />
            <span>
              days · served {est.notice.servedDays} ({fmtDate(est.notice.startedOn)} → {fmtDate(est.notice.exitDate)})
            </span>
            {shortfall > 0 && <span className="text-destructive">short by {shortfall}</span>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <span className="tabular-nums">
          {inr(salary)} + {inr(leaveAmount)} − {inr(recovery)} = <strong>{inr(salary + leaveAmount - recovery)}</strong>
        </span>
        <Button size="sm" onClick={() => onUse({ lastSalary: salary, leaveEncashment: leaveAmount, noticeRecovery: recovery })}>
          Use these amounts
        </Button>
      </div>
    </section>
  );
}

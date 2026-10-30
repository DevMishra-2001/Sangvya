"use client";

import { useState } from "react";
import { DoorOpen, RotateCcw, Undo2 } from "lucide-react";
import { DatePicker } from "@/components/common/date-picker";
import { FormField } from "@/components/common/form-field";
import { FormActions, FormGrid, FormHeading } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { EXIT_REASON_LABELS, EXIT_REASON_OPTIONS } from "@/lib/constants";
import { fmtDate, isoDate } from "@/lib/format";
import { employeesService } from "@/lib/services/employees";
import type { Employee, ExitReason } from "@/lib/types";

// Leaving the company: record the last working day and reason (notice), cancel a notice, or rehire someone who left.
export function EmployeeExitPanel({ employee, isMe, teamSize, onChange }: { employee: Employee; isMe: boolean; teamSize: number; onChange: (e: Employee) => void }) {
  const [lastDay, setLastDay] = useState(employee.exit_date ?? "");
  const [reason, setReason] = useState<string>(employee.exit_reason ?? "");
  const [notes, setNotes] = useState(employee.exit_notes ?? "");
  const [errors, setErrors] = useState<{ lastDay?: string; reason?: string }>({});
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<Employee>, success: string) {
    setBusy(true);
    const result = await run(fn, { success });
    setBusy(false);
    if (result.ok) onChange(result.data);
  }

  function submit() {
    const next = { lastDay: lastDay ? undefined : "Pick the last working day", reason: reason ? undefined : "Pick a reason" };
    setErrors(next);
    if (next.lastDay || next.reason) return;
    const past = lastDay < isoDate(new Date());
    act(
      () => employeesService.startExit(employee.id, { lastWorkingDay: lastDay, reason: reason as ExitReason, notes: notes.trim() || undefined }),
      past ? `${employee.name} is marked as left` : employee.status === "notice" ? "Exit updated" : `${employee.name} is now serving notice`,
    );
  }

  if (isMe) {
    return <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">Your own exit is handled by someone else in your company.</p>;
  }

  if (employee.status === "exited") {
    return (
      <section className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold">{employee.name} has left</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Last working day {fmtDate(employee.exit_date)}
          {employee.exit_reason && ` · ${EXIT_REASON_LABELS[employee.exit_reason]}`}
        </p>
        {employee.exit_notes && <p className="mt-2 text-sm">{employee.exit_notes}</p>}
        <p className="mt-3 text-xs text-muted-foreground">Their login is blocked and they&apos;re no longer counted on your plan. Rehiring makes them active again; unblock their login from Edit afterwards.</p>
        <Button className="mt-4" variant="outline" disabled={busy} onClick={() => act(() => employeesService.rehire(employee.id), `${employee.name} rehired`)}>
          <RotateCcw /> Rehire
        </Button>
      </section>
    );
  }

  const past = Boolean(lastDay) && lastDay < isoDate(new Date());
  return (
    <section className="rounded-xl border bg-card">
      <FormHeading title={employee.status === "notice" ? `Serving notice · last working day ${fmtDate(employee.exit_date)}` : "Start an exit"} />
      <div className="p-4">
        <FormGrid>
          <FormField label="Last working day" htmlFor="exit-day" error={errors.lastDay ? { message: errors.lastDay } : undefined} required>
            <DatePicker id="exit-day" value={lastDay} onChange={setLastDay} invalid={Boolean(errors.lastDay)} />
          </FormField>
          <FormField label="Reason" htmlFor="exit-reason" error={errors.reason ? { message: errors.reason } : undefined} required>
            <SelectField id="exit-reason" value={reason} onValueChange={setReason} placeholder="Why they're leaving" options={EXIT_REASON_OPTIONS} invalid={Boolean(errors.reason)} />
          </FormField>
          <FormField label="Notes" htmlFor="exit-notes" span="md">
            <Textarea id="exit-notes" rows={2} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder="Handover, notice period, full & final status…" />
          </FormField>
          <FormActions>
            <Button type="button" variant={past ? "destructive" : "default"} onClick={submit} disabled={busy}>
              <DoorOpen /> {employee.status === "notice" ? "Update exit" : past ? "Mark as left" : "Start notice"}
            </Button>
            {employee.status === "notice" && (
              <Button type="button" variant="outline" disabled={busy} onClick={() => act(() => employeesService.cancelExit(employee.id), "Exit cancelled")}>
                <Undo2 /> Cancel exit
              </Button>
            )}
          </FormActions>
        </FormGrid>
        {teamSize > 0 && (
          <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
            {teamSize} {teamSize === 1 ? "person reports" : "people report"} to {employee.name}. Set a new “Reports to” for them — once {employee.name} has left, their
            leave requests go to HR until you do.
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {past
            ? "That day has passed, so they'll be marked as left right away: their login is blocked and they stop counting on your plan."
            : "They keep working until the last working day. The day after, they're marked as left automatically and their login is blocked."}
        </p>
      </div>
    </section>
  );
}

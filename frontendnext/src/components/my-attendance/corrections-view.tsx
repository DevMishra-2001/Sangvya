"use client";

import { useEffect, useState } from "react";
import { Check, Send, Undo2, X } from "lucide-react";
import { DatePicker } from "@/components/common/date-picker";
import { FormField } from "@/components/common/form-field";
import { FormActions, FormGrid, FormHeading } from "@/components/common/form-layout";
import { NotLinkedState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PersonAvatar } from "@/components/common/person-avatar";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { fmtDate, fmtTime, isoDate } from "@/lib/format";
import { correctionsService } from "@/lib/services/corrections";
import type { AttendanceCorrection } from "@/lib/types";
import { useCan, useUser } from "@/stores/auth-store";

const DAYS_BACK = 30;
const span = (inIso: string | null, outIso: string | null) => (inIso ? `${fmtTime(inIso)} – ${fmtTime(outIso)}` : "No check-in");
const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
};

// One request waiting for a decision (manager / HR)
function ReviewRow({ c, onDone }: { c: AttendanceCorrection; onDone: (c: AttendanceCorrection) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function decide(status: "approved" | "rejected") {
    setBusy(true);
    const result = await run(() => correctionsService.decide(c.id, status, note || undefined), { success: status === "approved" ? "Correction approved — the day is updated" : "Correction rejected" });
    setBusy(false);
    if (result.ok) onDone(result.data);
  }
  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-2.5">
          <PersonAvatar name={c.employee_name} photoUrl={c.employee_photo} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{c.employee_name}</span>
            <span className="block text-xs text-muted-foreground">{fmtDate(c.date)}</span>
          </span>
        </span>
      </TableCell>
      <TableCell className="text-sm tabular-nums">
        <span className="block font-medium">{span(c.punch_in, c.punch_out)}</span>
        <span className="block text-xs text-muted-foreground">Now: {span(c.current_in, c.current_out)}</span>
      </TableCell>
      <TableCell className="max-w-xs text-sm whitespace-normal">{c.reason}</TableCell>
      <TableCell>
        {c.can_decide ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-8 w-40" aria-label={`Note for ${c.employee_name}`} maxLength={500} />
            <Button size="sm" variant="outline" className="border-success/40 text-success hover:bg-success/10" disabled={busy} onClick={() => decide("approved")}>
              <Check /> Approve
            </Button>
            <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" disabled={busy} onClick={() => decide("rejected")}>
              <X /> Reject
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">With {c.approver === "manager" ? (c.manager_name ?? "their manager") : "HR"}</span>
        )}
      </TableCell>
    </TableRow>
  );
}

// Attendance corrections: ask to fix a past day (your reporting manager decides), and — for managers / HR — the requests waiting for a decision
export function CorrectionsView() {
  const user = useUser();
  const can = useCan();
  const reviewer = user.team_size > 0 || can("attendance.mark");
  const today = isoDate(new Date());
  const [mine, setMine] = useState<AttendanceCorrection[] | null>(null);
  const [toReview, setToReview] = useState<AttendanceCorrection[] | null>(null);
  const [date, setDate] = useState("");
  const [punchIn, setPunchIn] = useState("09:00");
  const [punchOut, setPunchOut] = useState("18:00");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ date?: string; reason?: string; times?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user.employee_id) return;
    run(correctionsService.mine).then((r) => setMine(r.ok ? r.data : []));
  }, [user.employee_id]);
  useEffect(() => {
    if (reviewer) run(() => correctionsService.toReview("pending")).then((r) => setToReview(r.ok ? r.data : []));
  }, [reviewer]);

  async function submit() {
    const next = {
      date: date ? undefined : "Pick the day",
      times: punchIn && punchOut && punchIn !== punchOut ? undefined : "Check-in and check-out must be different times",
      reason: reason.trim().length >= 5 ? undefined : "Say why (at least 5 characters)",
    };
    setErrors(next);
    if (next.date || next.times || next.reason) return;
    setBusy(true);
    const result = await run(() => correctionsService.request({ date, punchIn, punchOut, reason: reason.trim() }), { success: "Correction sent for approval" });
    setBusy(false);
    if (!result.ok) return;
    setMine((m) => [result.data, ...(m ?? [])]);
    setDate("");
    setReason("");
  }

  async function withdraw(c: AttendanceCorrection) {
    const result = await run(() => correctionsService.withdraw(c.id), { success: "Request withdrawn" });
    if (result.ok) setMine((m) => (m ?? []).filter((x) => x.id !== c.id));
  }

  if (!user.employee_id && !reviewer) return <NotLinkedState />;
  const waiting = (toReview ?? []).filter((c) => c.status === "pending");
  const mineToDecide = waiting.filter((c) => c.can_decide).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Attendance corrections"
        description="Forgot to check out, or your check-in didn't go through? Ask to fix a past day — your reporting manager approves it (HR if you have none)."
        className="mb-0"
      />

      {reviewer && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <FormHeading title={`Waiting for a decision · ${mineToDecide} for you${waiting.length > mineToDecide ? ` · ${waiting.length - mineToDecide} with others` : ""}`} />
          {toReview === null ? (
            <div className="flex justify-center p-6">
              <Spinner />
            </div>
          ) : waiting.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No corrections waiting.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Asked for</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waiting.map((c) => (
                  <ReviewRow key={c.id} c={c} onDone={(u) => setToReview((list) => (list ?? []).map((x) => (x.id === u.id ? u : x)))} />
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}

      {user.employee_id && (
        <section className="rounded-xl border bg-card">
          <FormHeading title="Ask for a correction" />
          <div className="p-4">
            <FormGrid>
              <FormField label="Day" htmlFor="cor-date" error={errors.date ? { message: errors.date } : undefined} required>
                <DatePicker id="cor-date" value={date} onChange={setDate} min={shift(today, -DAYS_BACK)} max={shift(today, -1)} invalid={Boolean(errors.date)} />
              </FormField>
              <FormField label="Check-in" htmlFor="cor-in" error={errors.times ? { message: errors.times } : undefined} required>
                <Input id="cor-in" type="time" value={punchIn} onChange={(e) => setPunchIn(e.target.value)} />
              </FormField>
              <FormField label="Check-out" htmlFor="cor-out" required description="Earlier than check-in = next morning">
                <Input id="cor-out" type="time" value={punchOut} onChange={(e) => setPunchOut(e.target.value)} />
              </FormField>
              <FormField label="Reason" htmlFor="cor-reason" error={errors.reason ? { message: errors.reason } : undefined} required span="md">
                <Textarea id="cor-reason" rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Forgot to check out after the client meeting" />
              </FormField>
              <FormActions>
                <Button type="button" onClick={submit} disabled={busy}>
                  <Send /> Send for approval
                </Button>
              </FormActions>
            </FormGrid>
            <p className="mt-2 text-xs text-muted-foreground">Any of the last {DAYS_BACK} days. Once approved, the day shows exactly these times and the late mark is worked out again.</p>
          </div>
        </section>
      )}

      {user.employee_id && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <FormHeading title="My requests" />
          {mine === null ? (
            <div className="flex justify-center p-6">
              <Spinner />
            </div>
          ) : mine.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No correction requests in the last 90 days.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Asked for</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {mine.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{fmtDate(c.date)}</TableCell>
                    <TableCell className="tabular-nums">{span(c.punch_in, c.punch_out)}</TableCell>
                    <TableCell className="max-w-xs text-sm whitespace-normal">{c.reason}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {c.status === "pending"
                          ? `With ${c.approver === "manager" ? (c.manager_name ?? "your manager") : "HR"}`
                          : [c.reviewed_by_name, c.review_note].filter(Boolean).join(" · ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.status === "pending" && (
                        <Button size="sm" variant="ghost" onClick={() => withdraw(c)}>
                          <Undo2 /> Withdraw
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}
    </div>
  );
}

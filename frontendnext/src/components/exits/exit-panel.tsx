"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Laptop, Lock } from "lucide-react";
import { DatePicker } from "@/components/common/date-picker";
import { FormField } from "@/components/common/form-field";
import { FormGrid } from "@/components/common/form-layout";
import { PersonAvatar } from "@/components/common/person-avatar";
import { SelectField } from "@/components/common/select-field";
import { StarRating } from "@/components/common/star-rating";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { EXIT_REASON_LABELS } from "@/lib/constants";
import { fmtDate, inr, isoDate } from "@/lib/format";
import { EXIT_STAGE_LABELS, exitsService, type ExitDetail } from "@/lib/services/exits";
import type { Id } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SettlementCalculator } from "./settlement-calculator";

const AMOUNTS = [
  { key: "lastSalary", col: "last_salary", label: "Salary for days worked", sign: 1 },
  { key: "leaveEncashment", col: "leave_encashment", label: "Leave encashment", sign: 1 },
  { key: "bonus", col: "bonus", label: "Bonus / incentives", sign: 1 },
  { key: "noticeRecovery", col: "notice_recovery", label: "Notice period recovery", sign: -1 },
  { key: "otherDeductions", col: "other_deductions", label: "Other deductions (assets, advances)", sign: -1 },
] as const;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}

// One exit: overview, clearance checklist, full & final, interview
export function ExitPanel({ employeeId, onClose, onChanged }: { employeeId: Id | null; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<ExitDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [settleStatus, setSettleStatus] = useState("pending");
  const [settledOn, setSettledOn] = useState("");
  const [settleNotes, setSettleNotes] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [rejoin, setRejoin] = useState("");
  const [interview, setInterview] = useState("");

  function fill(x: ExitDetail) {
    setD(x);
    setAmounts(Object.fromEntries(AMOUNTS.map((a) => [a.key, x.record[a.col] ? String(Number(x.record[a.col])) : ""])));
    setSettleStatus(x.record.settlement_status);
    setSettledOn(x.record.settled_on ?? "");
    setSettleNotes(x.record.settlement_notes ?? "");
    setRating(x.record.interview_rating);
    setRejoin(x.record.would_rejoin == null ? "" : x.record.would_rejoin ? "yes" : "no");
    setInterview(x.record.interview_notes ?? "");
  }

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    run(() => exitsService.detail(employeeId)).then((r) => !cancelled && r.ok && fill(r.data));
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  async function call(key: string, fn: () => Promise<ExitDetail>, success: string) {
    setBusy(key);
    const r = await run(fn, { success });
    setBusy(null);
    if (!r.ok) return;
    fill(r.data);
    onChanged();
  }

  const net = AMOUNTS.reduce((t, a) => t + a.sign * (Number(amounts[a.key]) || 0), 0);
  const e = d?.exit;
  const clearanceDone = d ? d.clearance.every((c) => c.done) && d.openAssets.length === 0 : false;

  return (
    <Sheet
      open={Boolean(employeeId)}
      onOpenChange={(o) => {
        if (!o) {
          setD(null);
          onClose();
        }
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {!d || !e ? (
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-center gap-3">
                <PersonAvatar name={e.name} photoUrl={e.photo_url} className="size-11" />
                <div className="min-w-0">
                  <SheetTitle className="truncate">{e.name}</SheetTitle>
                  <SheetDescription>{[e.designation, e.department].filter(Boolean).join(" · ") || "—"}</SheetDescription>
                </div>
                <StatusBadge tone={e.stage === "completed" ? "success" : e.stage === "notice" ? "warning" : "info"} className="mr-8 ml-auto shrink-0">
                  {EXIT_STAGE_LABELS[e.stage]}
                </StatusBadge>
              </div>
            </SheetHeader>

            <Tabs defaultValue={e.stage === "settlement" ? "settlement" : e.stage === "notice" ? "overview" : "clearance"} className="px-4 pb-6">
              <TabsList className="w-full">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="clearance">Clearance</TabsTrigger>
                <TabsTrigger value="settlement">F&amp;F</TabsTrigger>
                <TabsTrigger value="interview">Interview</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <div className="divide-y rounded-lg border px-3">
                  <Row label="Reason" value={e.exit_reason && EXIT_REASON_LABELS[e.exit_reason]} />
                  <Row label="Last working day" value={fmtDate(e.exit_date)} />
                  <Row label="Exit started" value={fmtDate(e.started_on)} />
                  <Row label="Joined" value={fmtDate(e.join_date)} />
                  <Row label="Monthly salary" value={e.salary ? inr(e.salary) : null} />
                  <Row label="Notes" value={e.exit_notes} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Change the last day or cancel the exit from the{" "}
                  <Link href={`/employees/${e.id}`} className="text-primary hover:underline">
                    employee&apos;s profile → Exit
                  </Link>
                  .
                </p>
              </TabsContent>

              <TabsContent value="clearance" className="mt-4 flex flex-col gap-2">
                <div className={cn("flex items-start gap-3 rounded-lg border p-3", d.openAssets.length ? "border-warning/50 bg-warning/5" : "")}>
                  {d.openAssets.length ? <Laptop className="mt-0.5 size-4 text-warning" /> : <CheckCircle2 className="mt-0.5 size-4 text-success" />}
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">Company assets returned</p>
                    {d.openAssets.length ? (
                      <>
                        <ul className="mt-1 text-xs text-muted-foreground">
                          {d.openAssets.map((a) => (
                            <li key={a.id}>
                              {a.asset_code} · {a.name} (since {fmtDate(a.assigned_on)})
                            </li>
                          ))}
                        </ul>
                        <Link href={`/assets?status=assigned&search=${encodeURIComponent(e.name)}`} className="mt-1 inline-block text-xs text-primary hover:underline">
                          Take them back on the Assets page →
                        </Link>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nothing pending — checked automatically.</p>
                    )}
                  </div>
                </div>
                {d.clearance.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    disabled={busy !== null || Boolean(e && d.record.completed_at)}
                    onClick={() => call(c.key, () => exitsService.clearance(e.id, c.key, { done: !c.done }), c.done ? "Re-opened" : "Cleared")}
                    className={cn("flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/50 disabled:opacity-70", c.done && "bg-success/5")}
                  >
                    {busy === c.key ? <Spinner className="mt-0.5 size-4" /> : c.done ? <CheckCircle2 className="mt-0.5 size-4 text-success" /> : <Circle className="mt-0.5 size-4 text-muted-foreground" />}
                    <span className="min-w-0 flex-1 text-sm">
                      <span className={cn("block font-medium", c.done && "text-muted-foreground line-through")}>{c.label}</span>
                      {c.done && <span className="block text-xs text-muted-foreground">by {c.by ?? "—"}</span>}
                    </span>
                  </button>
                ))}
              </TabsContent>

              <TabsContent value="settlement" className="mt-4">
                {!clearanceDone && <p className="mb-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">Clearance isn&apos;t finished — you can draft the F&amp;F, but it can be marked paid only after clearance and the last working day.</p>}
                {settleStatus !== "paid" && e.stage !== "completed" && (
                  <SettlementCalculator
                    key={e.id}
                    employeeId={e.id}
                    onUse={(v) => setAmounts((m) => ({ ...m, lastSalary: String(v.lastSalary), leaveEncashment: String(v.leaveEncashment), noticeRecovery: String(v.noticeRecovery) }))}
                  />
                )}
                <FormGrid density="dialog">
                  {AMOUNTS.map((a) => (
                    <FormField key={a.key} label={`${a.label}${a.sign < 0 ? " (−)" : ""}`} htmlFor={`ff-${a.key}`} span="full">
                      <Input id={`ff-${a.key}`} type="number" min={0} inputMode="decimal" value={amounts[a.key] ?? ""} onChange={(ev) => setAmounts((m) => ({ ...m, [a.key]: ev.target.value }))} />
                    </FormField>
                  ))}
                  <div className="col-span-12 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <span className="text-sm text-muted-foreground">Net payable</span>
                    <span className={cn("text-lg font-semibold tabular-nums", net < 0 && "text-destructive")}>{inr(net)}</span>
                  </div>
                  <FormField label="Status" htmlFor="ff-status" span="md">
                    <SelectField
                      id="ff-status"
                      value={settleStatus}
                      onValueChange={setSettleStatus}
                      options={[
                        { value: "pending", label: "Draft" },
                        { value: "approved", label: "Approved" },
                        { value: "paid", label: "Paid" },
                      ]}
                    />
                  </FormField>
                  {settleStatus === "paid" && (
                    <FormField label="Paid on" htmlFor="ff-on" span="md">
                      <DatePicker id="ff-on" value={settledOn || isoDate(new Date())} onChange={setSettledOn} />
                    </FormField>
                  )}
                  <FormField label="Notes" htmlFor="ff-notes" span="full">
                    <Textarea id="ff-notes" rows={2} value={settleNotes} onChange={(ev) => setSettleNotes(ev.target.value)} />
                  </FormField>
                </FormGrid>
                <Button
                  className="mt-3"
                  disabled={busy !== null}
                  onClick={() =>
                    call(
                      "settlement",
                      () =>
                        exitsService.settlement(e.id, {
                          ...Object.fromEntries(AMOUNTS.map((a) => [a.key, amounts[a.key] === "" ? null : Number(amounts[a.key])])),
                          status: settleStatus,
                          settledOn: settleStatus === "paid" ? settledOn || isoDate(new Date()) : null,
                          notes: settleNotes || null,
                        }),
                      "Full & final saved",
                    )
                  }
                >
                  {busy === "settlement" && <Spinner />} Save F&amp;F
                </Button>
              </TabsContent>

              <TabsContent value="interview" className="mt-4">
                <FormGrid density="dialog">
                  <FormField label="How was working here?" htmlFor="ei-rating" span="md" float={false}>
                    <StarRating value={rating} onChange={setRating} />
                  </FormField>
                  <FormField label="Would they come back?" htmlFor="ei-rejoin" span="md">
                    <SelectField
                      id="ei-rejoin"
                      value={rejoin}
                      onValueChange={setRejoin}
                      emptyLabel="— Not asked —"
                      options={[
                        { value: "yes", label: "Yes" },
                        { value: "no", label: "No" },
                      ]}
                    />
                  </FormField>
                  <FormField label="What they said" htmlFor="ei-notes" span="full">
                    <Textarea id="ei-notes" rows={5} value={interview} onChange={(ev) => setInterview(ev.target.value)} placeholder="Reason for leaving, what we could do better…" />
                  </FormField>
                </FormGrid>
                <Button
                  className="mt-3"
                  disabled={busy !== null}
                  onClick={() => call("interview", () => exitsService.interview(e.id, { notes: interview || null, rating, wouldRejoin: rejoin === "" ? null : rejoin === "yes" }), "Interview saved")}
                >
                  {busy === "interview" && <Spinner />} Save interview
                </Button>
              </TabsContent>
            </Tabs>

            <div className="mt-auto border-t p-4">
              {d.record.completed_at ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="size-4" /> Exit closed on {fmtDate(d.record.completed_at)}
                </p>
              ) : (
                <Button
                  className="w-full"
                  disabled={busy !== null || e.status !== "exited" || !clearanceDone || d.record.settlement_status !== "paid"}
                  onClick={() => call("complete", () => exitsService.complete(e.id), "Exit closed")}
                >
                  {busy === "complete" ? <Spinner /> : <Lock />} Close exit
                </Button>
              )}
              {!d.record.completed_at && (
                <p className="mt-2 text-center text-xs text-muted-foreground">Needs: last working day passed · clearance done · F&amp;F paid</p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

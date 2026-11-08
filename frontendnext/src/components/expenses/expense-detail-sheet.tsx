"use client";

// One expense or advance: everything entered, files, and the approve / reject / hold / pay actions
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, FileText, Paperclip, Pause, Pencil, Printer, Wallet, X } from "lucide-react";
import { DatePicker } from "@/components/common/date-picker";
import { FormField } from "@/components/common/form-field";
import { FormGrid } from "@/components/common/form-layout";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { fmtDate, inr, isoDate } from "@/lib/format";
import { expensesService, type Advance, type ClaimDetail } from "@/lib/services/expenses";
import { STATUS } from "./expense-shared";

type Target = { kind: "claim" | "advance"; id: number } | null;
type Data = { kind: "claim"; d: ClaimDetail } | { kind: "advance"; a: Advance; can: { decide: boolean; pay: boolean } };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}

export function ExpenseDetailSheet({ target, onClose, onChanged }: { target: Target; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [note, setNote] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [pay, setPay] = useState({ paidOn: "", reference: "", emiMonths: "1" });
  const [busy, setBusy] = useState<string | null>(null);

  function show(x: Data) {
    setData(x);
    setApprovedAmount(x.kind === "claim" ? String(Number(x.d.claim.total)) : "");
  }

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    queueMicrotask(() => {
      setNote("");
      setPay({ paidOn: isoDate(new Date()), reference: "", emiMonths: "1" });
    });
    const load = target.kind === "claim" ? expensesService.claim(target.id).then((d): Data => ({ kind: "claim", d })) : expensesService.advance(target.id).then((x): Data => ({ kind: "advance", a: x.advance, can: x.can }));
    load.then((x) => !cancelled && show(x)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [target]);

  async function act(key: string, fn: () => Promise<unknown>, success: string) {
    if (!target) return;
    setBusy(key);
    const r = await run(fn, { success });
    setBusy(null);
    if (!r.ok) return;
    onChanged();
    const fresh = target.kind === "claim" ? await run(() => expensesService.claim(target.id), { silent: true }) : await run(() => expensesService.advance(target.id), { silent: true });
    if (fresh.ok) show(target.kind === "claim" ? { kind: "claim", d: fresh.data as ClaimDetail } : { kind: "advance", a: (fresh.data as { advance: Advance }).advance, can: (fresh.data as { can: { decide: boolean; pay: boolean } }).can });
  }

  async function openFile(index: number) {
    if (!target) return;
    const tab = window.open("", "_blank");
    const r = await run(() => (target.kind === "claim" ? expensesService.claimFile(target.id, index) : expensesService.advanceFile(target.id, index)));
    if (r.ok && tab) tab.location.href = r.data;
    else tab?.close();
  }

  const status = data ? (data.kind === "claim" ? data.d.claim.status : data.a.status) : null;
  const canDecide = data ? (data.kind === "claim" ? data.d.can.decide : data.can.decide) : false;
  const canPay = data ? (data.kind === "claim" ? data.d.can.pay : data.can.pay) : false;
  const decide = (action: "approve" | "reject" | "hold") =>
    act(
      action,
      () =>
        target!.kind === "claim"
          ? expensesService.decideClaim(target!.id, { action, note: note || null, approvedAmount: action === "approve" && approvedAmount ? Number(approvedAmount) : undefined })
          : expensesService.decideAdvance(target!.id, { action, note: note || null }),
      action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "Put on hold",
    );

  return (
    <Sheet open={Boolean(target)} onOpenChange={(o) => !o && (setData(null), onClose())}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {!data ? (
          <div className="flex flex-col gap-3 p-6">
            <SheetTitle className="sr-only">Expense</SheetTitle>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="border-b p-5">
              <div className="flex items-start gap-3 pr-8">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">{data.kind === "claim" ? data.d.claim.trip_name : data.a.advance_type === "salary" ? "Advance against salary" : "Advance against TA/DA"}</SheetTitle>
                  <SheetDescription>
                    {data.kind === "claim" ? `${data.d.claim.employee_name} · ${fmtDate(data.d.claim.claim_date)}` : `${data.a.employee_name} · requested ${fmtDate(data.a.created_at)}`}
                  </SheetDescription>
                </div>
                {status && <StatusBadge tone={STATUS[status].tone}>{STATUS[status].label}</StatusBadge>}
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">{inr(Number(data.kind === "claim" ? data.d.claim.total : data.a.amount))}</p>
              {data.kind === "claim" && data.d.claim.approved_amount != null && Number(data.d.claim.approved_amount) !== Number(data.d.claim.total) && <p className="text-sm text-muted-foreground">Approved {inr(Number(data.d.claim.approved_amount))}</p>}
            </SheetHeader>

            <div className="flex flex-col gap-4 p-5">
              {data.kind === "claim" ? (
                <>
                  <div className="divide-y rounded-lg border px-3">
                    <Row label="Place" value={[data.d.claim.locality, data.d.claim.city, data.d.claim.state, data.d.claim.country].filter(Boolean).join(", ")} />
                    <Row label="Client" value={data.d.claim.client_name} />
                    <Row label="Teammates" value={data.d.claim.teammates} />
                    <Row label="Type" value={data.d.claim.expense_type === "international" ? "International" : "Domestic"} />
                  </div>
                  <div className="divide-y rounded-lg border px-3">
                    {Number(data.d.claim.hotel_amount) > 0 && <Row label={`Hotel${data.d.claim.hotel_name ? ` · ${data.d.claim.hotel_name}` : ""}`} value={inr(Number(data.d.claim.hotel_amount))} />}
                    {Number(data.d.claim.breakfast) + Number(data.d.claim.lunch) + Number(data.d.claim.dinner) > 0 && (
                      <Row label={`Meals (B ${inr(Number(data.d.claim.breakfast))} · L ${inr(Number(data.d.claim.lunch))} · D ${inr(Number(data.d.claim.dinner))})`} value={inr(Number(data.d.claim.breakfast) + Number(data.d.claim.lunch) + Number(data.d.claim.dinner))} />
                    )}
                    {[...data.d.localTravel.map((l) => ({ ...l, k: "Local" })), ...data.d.intercityTravel.map((l) => ({ ...l, k: "Inter-city" }))].map((l, i) => (
                      <Row key={i} label={`${l.k} · ${l.travel_type.replace("_", " ")} · ${l.from_place ?? ""} → ${l.to_place ?? ""}`} value={inr(Number(l.amount))} />
                    ))}
                    {Number(data.d.claim.entertainment_amount) > 0 && <Row label={`Client entertainment${data.d.claim.entertainment_description ? ` · ${data.d.claim.entertainment_description}` : ""}`} value={inr(Number(data.d.claim.entertainment_amount))} />}
                    {Number(data.d.claim.other_amount) > 0 && <Row label={`Other${data.d.claim.other_description ? ` · ${data.d.claim.other_description}` : ""}`} value={inr(Number(data.d.claim.other_amount))} />}
                  </div>
                </>
              ) : (
                <div className="divide-y rounded-lg border px-3">
                  <Row label="Purpose" value={data.a.purpose} />
                  <Row label="Needed by" value={data.a.expected_date && fmtDate(data.a.expected_date)} />
                  <Row label="Bank" value={[data.a.bank_name, data.a.ifsc, data.a.account_number && `A/c ${data.a.account_number}`].filter(Boolean).join(" · ")} />
                  {data.a.loan_id && <Row label="Recovery" value="From salary (Payroll → Loans & advances)" />}
                </div>
              )}

              {/* Files */}
              {(data.kind === "claim" ? data.d.claim.attachments : data.a.attachments).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(data.kind === "claim" ? data.d.claim.attachments : data.a.attachments).map((f, i) => (
                    <Button key={f.path} size="sm" variant="outline" onClick={() => openFile(i)}>
                      <Paperclip /> {f.name}
                    </Button>
                  ))}
                </div>
              )}

              {/* Decision / payment so far */}
              {(() => {
                const x = data.kind === "claim" ? data.d.claim : data.a;
                return (
                  (x.decision_note || x.decided_by_name || x.paid_on) && (
                    <div className="rounded-lg bg-muted/50 p-3 text-sm">
                      {x.decided_by_name && (
                        <p>
                          Decided by <strong>{x.decided_by_name}</strong>
                          {x.decided_at && ` on ${fmtDate(x.decided_at)}`}
                        </p>
                      )}
                      {x.decision_note && <p className="mt-1">“{x.decision_note}”</p>}
                      {x.paid_on && (
                        <p className="mt-1">
                          Paid {inr(Number(x.paid_amount))} on {fmtDate(x.paid_on)}
                          {x.payment_ref && ` · ref ${x.payment_ref}`}
                        </p>
                      )}
                    </div>
                  )
                );
              })()}

              {canDecide && (
                <div className="flex flex-col gap-2 rounded-lg border p-3">
                  <p className="text-sm font-semibold">Your decision</p>
                  {data.kind === "claim" && (
                    <FormField label="Approve amount (₹)" htmlFor="ed-amt" description="Lower it to approve part of the claim">
                      <Input id="ed-amt" type="number" min={0} value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} />
                    </FormField>
                  )}
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the employee (needed to reject or hold)" aria-label="Note" />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy !== null} onClick={() => decide("approve")}>
                      {busy === "approve" ? <Spinner /> : <Check />} Approve
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy !== null || !note.trim()} onClick={() => decide("hold")}>
                      <Pause /> Hold
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busy !== null || !note.trim()} onClick={() => decide("reject")}>
                      <X /> Reject
                    </Button>
                  </div>
                </div>
              )}

              {canPay && (
                <div className="flex flex-col gap-2 rounded-lg border p-3">
                  <p className="text-sm font-semibold">Record payment</p>
                  <FormGrid density="dialog">
                    <FormField label="Paid on" htmlFor="ed-on" span="md">
                      <DatePicker id="ed-on" value={pay.paidOn} onChange={(d) => setPay((p) => ({ ...p, paidOn: d }))} />
                    </FormField>
                    <FormField label="Reference / UTR" htmlFor="ed-ref" span="md">
                      <Input id="ed-ref" value={pay.reference} onChange={(e) => setPay((p) => ({ ...p, reference: e.target.value }))} />
                    </FormField>
                    {data.kind === "advance" && data.a.advance_type === "salary" && (
                      <FormField label="Recover in (months)" htmlFor="ed-emi" span="md" description="Deducted from salary starting next month">
                        <Input id="ed-emi" type="number" min={1} max={36} value={pay.emiMonths} onChange={(e) => setPay((p) => ({ ...p, emiMonths: e.target.value }))} />
                      </FormField>
                    )}
                  </FormGrid>
                  <Button
                    size="sm"
                    className="self-start"
                    disabled={busy !== null || !pay.paidOn}
                    onClick={() =>
                      act(
                        "pay",
                        () => (target!.kind === "claim" ? expensesService.payClaim(target!.id, { paidOn: pay.paidOn, reference: pay.reference || null }) : expensesService.payAdvance(target!.id, { paidOn: pay.paidOn, reference: pay.reference || null, emiMonths: Number(pay.emiMonths) || 1 })),
                        "Payment recorded",
                      )
                    }
                  >
                    {busy === "pay" ? <Spinner /> : <Wallet />} Mark paid
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {data.kind === "claim" && (
                  <Button size="sm" variant="outline" onClick={() => run(() => expensesService.claimPdf(data.d.claim.id))}>
                    <Printer /> Print voucher
                  </Button>
                )}
                {data.kind === "claim" && data.d.can.edit && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/expenses/new?id=${data.d.claim.id}`}>
                      <Pencil /> Edit {data.d.claim.status === "draft" ? "& submit" : "& resubmit"}
                    </Link>
                  </Button>
                )}
                {data.kind === "advance" && data.a.loan_id && (
                  <Button size="sm" variant="ghost" asChild>
                    <Link href="/payroll">
                      <FileText /> Payroll recovery
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

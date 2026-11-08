"use client";

// Advance Request: ask for money up front (against salary or TA/DA); manager approves, accounts pays
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Wallet } from "lucide-react";
import { DatePicker } from "@/components/common/date-picker";
import { EmptyState, NotLinkedState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { FormCard, FormGrid, FormHeading } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { run } from "@/lib/api/run";
import { fmtDate, inr, isoDate, toMonth } from "@/lib/format";
import { expensesService, type Attachment, type ExpenseRow } from "@/lib/services/expenses";
import { useUser } from "@/stores/auth-store";
import { BalanceStrip, BillPicker, STATUS } from "./expense-shared";

const EMPTY = { advanceType: "tada", amount: "", purpose: "", ifsc: "", accountNumber: "", bankName: "", expectedDate: "" };

export function AdvanceRequestView() {
  const user = useUser();
  const [f, setF] = useState(EMPTY);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<ExpenseRow[] | null>(null);
  const [version, setVersion] = useState(0);

  // Bank details already on file fill the form
  useEffect(() => {
    if (!user.employee_id) return;
    let cancelled = false;
    expensesService
      .bank()
      .then((b) => !cancelled && b && setF((x) => ({ ...x, ifsc: x.ifsc || (b.ifsc ?? ""), accountNumber: x.accountNumber || (b.account_number ?? ""), bankName: x.bankName || (b.bank_name ?? "") })))
      .catch(() => {});
    queueMicrotask(() => setF((x) => (x.expectedDate ? x : { ...x, expectedDate: isoDate(new Date()) })));
    return () => {
      cancelled = true;
    };
  }, [user.employee_id]);

  useEffect(() => {
    if (!user.employee_id) return;
    let cancelled = false;
    run(() => expensesService.list({ kind: "advances", scope: "mine", limit: 50 }), { silent: true }).then((r) => !cancelled && setMine(r.ok ? r.data.rows : []));
    return () => {
      cancelled = true;
    };
  }, [user.employee_id, version]);

  if (!user.employee_id) return <NotLinkedState />;
  const set = (k: keyof typeof EMPTY) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    const r = await run(
      () => expensesService.createAdvance({ ...f, amount: Number(f.amount), expectedDate: f.expectedDate || null, ifsc: f.ifsc || null, accountNumber: f.accountNumber || null, bankName: f.bankName || null, attachments: files }),
      { success: "Advance requested — your manager is notified" },
    );
    setBusy(false);
    if (!r.ok) return;
    setF((x) => ({ ...x, amount: "", purpose: "" }));
    setFiles([]);
    setVersion((v) => v + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <FormCard
        title="Advance Request"
       
        icon={Wallet}
        actions={
          <Button asChild size="sm">
            <Link href="/expenses?kind=advances">
              <ArrowLeft /> Back to List
            </Link>
          </Button>
        }
        bodyClassName="flex flex-col gap-3"
      >
        <BalanceStrip month={toMonth(new Date())} className="border-dashed" />
        <FormGrid>
          <FormField label="Advance Type" htmlFor="ad-type" required>
            <SelectField
              id="ad-type"
              value={f.advanceType}
              onValueChange={set("advanceType")}
              options={[
                { value: "tada", label: "Against TA/DA" },
                { value: "salary", label: "Against Salary" },
              ]}
            />
          </FormField>
          <FormField label="Amount" htmlFor="ad-amt" required>
            <Input id="ad-amt" type="number" min={1} value={f.amount} onChange={(e) => set("amount")(e.target.value)} />
          </FormField>
          <FormField label="Purpose" htmlFor="ad-purpose" required>
            <Input id="ad-purpose" value={f.purpose} onChange={(e) => set("purpose")(e.target.value)} maxLength={1000} />
          </FormField>
          <FormField label="IFSC Code" htmlFor="ad-ifsc">
            <Input id="ad-ifsc" value={f.ifsc} onChange={(e) => set("ifsc")(e.target.value.toUpperCase())} maxLength={11} className="uppercase" />
          </FormField>
          <FormField label="Account Number" htmlFor="ad-acc">
            <Input id="ad-acc" inputMode="numeric" value={f.accountNumber} onChange={(e) => set("accountNumber")(e.target.value)} maxLength={18} />
          </FormField>
          <FormField label="Bank Name" htmlFor="ad-bank">
            <Input id="ad-bank" value={f.bankName} onChange={(e) => set("bankName")(e.target.value)} />
          </FormField>
          <FormField label="Advance Expected Date" htmlFor="ad-date">
            <DatePicker id="ad-date" value={f.expectedDate} onChange={set("expectedDate")} min={isoDate(new Date())} />
          </FormField>
          <div className="col-span-12 flex flex-wrap items-center gap-2 md:col-span-8">
            <BillPicker files={files} onChange={setFiles} />
            <Button onClick={save} disabled={busy || !(Number(f.amount) > 0) || f.purpose.trim().length < 3}>
              {busy ? <Spinner /> : <Save />} Save
            </Button>
          </div>
        </FormGrid>
        {f.advanceType === "salary" && <p className="text-xs text-muted-foreground">An advance against salary is recovered from your salary in the following month(s) once it&apos;s paid.</p>}
      </FormCard>

      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading title="My advance requests" />
        {!mine ? (
          <div className="p-6 text-center">
            <Spinner />
          </div>
        ) : !mine.length ? (
          <EmptyState icon={Wallet} title="No requests yet" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type / purpose</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {mine.map((a) => (
                  <AdvanceRow key={a.id} row={a} onChanged={() => setVersion((v) => v + 1)} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

// One request with the approver's note (loaded on open)
function AdvanceRow({ row, onChanged }: { row: ExpenseRow; onChanged: () => void }) {
  const [note, setNote] = useState<string | null | undefined>(undefined);
  async function toggle() {
    if (note !== undefined) return setNote(undefined);
    const r = await run(() => expensesService.advance(row.id), { silent: true });
    setNote(r.ok ? [r.data.advance.decision_note && `Note: ${r.data.advance.decision_note}`, r.data.advance.decided_by_name && `by ${r.data.advance.decided_by_name}`, r.data.advance.paid_on && `paid ${fmtDate(r.data.advance.paid_on)}${r.data.advance.payment_ref ? ` (ref ${r.data.advance.payment_ref})` : ""}`].filter(Boolean).join(" · ") || "No note yet" : null);
  }
  return (
    <>
      <TableRow className="cursor-pointer" onClick={toggle}>
        <TableCell>{fmtDate(row.date)}</TableCell>
        <TableCell className="max-w-96 truncate">{row.title}</TableCell>
        <TableCell className="text-right tabular-nums">{inr(row.total)}</TableCell>
        <TableCell>
          <StatusBadge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</StatusBadge>
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          {(row.status === "pending" || row.status === "on_hold") && (
            <Button size="sm" variant="ghost" onClick={async () => window.confirm("Cancel this request?") && (await run(() => expensesService.cancelAdvance(row.id), { success: "Request cancelled" })).ok && onChanged()}>
              Cancel
            </Button>
          )}
        </TableCell>
      </TableRow>
      {note !== undefined && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={5} className="text-sm">
            {note}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

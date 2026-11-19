"use client";

// One payroll run: totals, files to download, LOP fixes, one-time items, and every payslip
import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, Lock, Plus, RefreshCw, Trash2 } from "lucide-react";
import { ConfirmAction, ConfirmDelete } from "@/components/common/confirm-button";
import { FormField } from "@/components/common/form-field";
import { FormGrid } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { run } from "@/lib/api/run";
import { MONTHS } from "@/lib/constants";
import { inr } from "@/lib/format";
import { payrollService, type PayrollExport } from "@/lib/services/payroll";
import type { LopOverride, PayrollAdjustment, PayrollItemCategory, PayrollRun, PayrollRunTotals, Payslip } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { usePayrollStore } from "@/stores/payroll-store";

export const ITEM_TYPES: { value: PayrollItemCategory; label: string; deduction?: boolean }[] = [
  { value: "bonus", label: "Bonus" },
  { value: "incentive", label: "Incentive / commission" },
  { value: "arrears", label: "Arrears" },
  { value: "overtime", label: "Overtime" },
  { value: "reimbursement", label: "Reimbursement (not taxed)" },
  { value: "other_earning", label: "Other earning" },
  { value: "advance_recovery", label: "Advance recovery", deduction: true },
  { value: "fine", label: "Fine / penalty", deduction: true },
  { value: "other_deduction", label: "Other deduction", deduction: true },
];

const EXPORTS: { type: PayrollExport; label: string }[] = [
  { type: "register", label: "Salary register" },
  { type: "bank", label: "Bank transfer sheet" },
  { type: "pf_ecr", label: "PF ECR file (EPFO upload)" },
  { type: "esi", label: "ESI contribution" },
  { type: "pt", label: "Professional tax" },
  { type: "tds", label: "TDS on salary" },
];

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{inr(value)}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ItemDialog({ open, payslips, onClose, onSave }: { open: boolean; payslips: Payslip[]; onClose: () => void; onSave: (b: { employeeId: number; category: PayrollItemCategory; label: string; amount: number }) => Promise<boolean> }) {
  const [employeeId, setEmployeeId] = useState("");
  const [category, setCategory] = useState<PayrollItemCategory>("bonus");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const type = ITEM_TYPES.find((t) => t.value === category);

  async function save() {
    setBusy(true);
    const ok = await onSave({ employeeId: Number(employeeId), category, label: label.trim() || type!.label, amount: Number(amount) });
    setBusy(false);
    if (ok) {
      setLabel("");
      setAmount("");
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a one-time item</DialogTitle>
          <DialogDescription>Only for this month. Bonus and arrears are taxed; reimbursements are paid as they are.</DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          <FormField label="Employee" htmlFor="pi-emp" required span="full">
            <SelectField id="pi-emp" value={employeeId} onValueChange={setEmployeeId} placeholder="Pick an employee" options={payslips.map((p) => ({ value: String(p.employee_id), label: p.employee_name }))} />
          </FormField>
          <FormField label="Type" htmlFor="pi-type" required span="md">
            <SelectField id="pi-type" value={category} onValueChange={(v) => setCategory(v as PayrollItemCategory)} options={ITEM_TYPES.map((t) => ({ value: t.value, label: `${t.deduction ? "− " : "+ "}${t.label}` }))} />
          </FormField>
          <FormField label="Amount (₹)" htmlFor="pi-amt" required span="md">
            <Input id="pi-amt" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
          <FormField label="Description" htmlFor="pi-label" span="full">
            <Input id="pi-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={type?.label} maxLength={120} />
          </FormField>
        </FormGrid>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !employeeId || !(Number(amount) > 0)}>
            {busy && <Spinner />} Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LopDialog({ slip, override, onClose, onSave }: { slip: Payslip | null; override?: LopOverride; onClose: () => void; onSave: (lop: number | null, note: string) => Promise<boolean> }) {
  const [lop, setLop] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!slip) return;
    queueMicrotask(() => {
      setLop(String(Number(slip.lop_days)));
      setNote(override?.note ?? "");
    });
  }, [slip, override]);

  async function save(value: number | null) {
    setBusy(true);
    const ok = await onSave(value, note);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Dialog open={Boolean(slip)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Loss of pay</DialogTitle>
          <DialogDescription>
            {slip?.employee_name} · {override ? "set by HR" : "from attendance"}: {Number(slip?.lop_days ?? 0)} day(s)
          </DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          <FormField label="LOP days" htmlFor="lop-days" span="md">
            <Input id="lop-days" type="number" min={0} max={slip?.total_days} step={0.5} value={lop} onChange={(e) => setLop(e.target.value)} />
          </FormField>
          <FormField label="Reason" htmlFor="lop-note" span="full">
            <Input id="lop-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Leave approved late" maxLength={200} />
          </FormField>
        </FormGrid>
        <DialogFooter>
          {override && (
            <Button variant="ghost" className="mr-auto" disabled={busy} onClick={() => save(null)}>
              Use attendance again
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || lop === ""} onClick={() => save(Number(lop))}>
            {busy && <Spinner />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RunDetail({ run: selected, onDeleted }: { run: PayrollRun; onDeleted: () => void }) {
  const canManage = useCan()("payroll.manage");
  const payslips = usePayrollStore((s) => s.payslipsByRun[selected.id]);
  const loadPayslips = usePayrollStore((s) => s.loadPayslips);
  const loadRuns = usePayrollStore((s) => s.loadRuns);
  const busy = usePayrollStore((s) => s.busy);
  const recalculate = usePayrollStore((s) => s.recalculate);
  const finalize = usePayrollStore((s) => s.finalize);
  const deleteRun = usePayrollStore((s) => s.deleteRun);
  const download = usePayrollStore((s) => s.download);
  const [totals, setTotals] = useState<PayrollRunTotals | null>(null);
  const [items, setItems] = useState<{ adjustments: PayrollAdjustment[]; lopOverrides: LopOverride[] }>({ adjustments: [], lopOverrides: [] });
  const [adding, setAdding] = useState(false);
  const [lopFor, setLopFor] = useState<Payslip | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const draft = selected.status === "draft";
  const period = `${MONTHS[selected.month - 1]} ${selected.year}`;

  // Totals + items, reloaded after any change to the run
  const reloadExtras = useCallback(async () => {
    const [s, i] = await Promise.all([run(() => payrollService.summary(selected.id), { silent: true }), run(() => payrollService.items(selected.id), { silent: true })]);
    if (s.ok) setTotals(s.data.totals);
    if (i.ok) setItems(i.data);
  }, [selected.id]);

  useEffect(() => {
    let cancelled = false;
    loadPayslips(selected.id);
    Promise.all([payrollService.summary(selected.id), payrollService.items(selected.id)])
      .then(([s, i]) => {
        if (cancelled) return;
        setTotals(s.totals);
        setItems(i);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selected.id, selected.run_at, selected.status, loadPayslips]);

  async function changed(fn: () => Promise<{ adjustments: PayrollAdjustment[]; lopOverrides: LopOverride[] }>, success: string) {
    const r = await run(fn, { success });
    if (!r.ok) return false;
    setItems({ adjustments: r.data.adjustments, lopOverrides: r.data.lopOverrides });
    await Promise.all([loadPayslips(selected.id), loadRuns(), reloadExtras()]);
    return true;
  }

  async function exportFile(type: PayrollExport) {
    await run(() => payrollService.exportRun(selected.id, type), { error: "Could not make the file" });
  }

  const overrideOf = (employeeId: number) => items.lopOverrides.find((o) => o.employee_id === employeeId);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            {period}
            <StatusBadge tone={draft ? "warning" : "success"}>{draft ? "Draft" : "Finalized"}</StatusBadge>
          </div>
          <div className="text-xs text-muted-foreground">
            {selected.employee_count} payslip{selected.employee_count === 1 ? "" : "s"} · {draft ? "employees can't see it yet" : `finalized${selected.finalized_by_name ? ` by ${selected.finalized_by_name}` : ""}`}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileSpreadsheet /> Download <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {EXPORTS.map((e) => (
                <DropdownMenuItem key={e.type} onSelect={() => exportFile(e.type)}>
                  {e.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {canManage && draft && (
            <>
              <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                <Plus /> Bonus / deduction
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={async () => (await recalculate(selected.id), reloadExtras())}>
                <RefreshCw /> Recalculate
              </Button>
              <ConfirmAction
                title={`Finalize ${period}?`}
                description="It's locked after this: loan EMIs are recorded and every employee gets their payslip (in the app and by email)."
                confirmLabel="Finalize"
                onConfirm={() => finalize(selected.id)}
              >
                <Button size="sm" disabled={busy}>
                  <Lock /> Finalize
                </Button>
              </ConfirmAction>
              <ConfirmDelete title={`Delete the ${period} draft?`} onConfirm={async () => (await deleteRun(selected.id)) && onDeleted()} label="Delete draft" />
            </>
          )}
        </div>
      </div>

      {totals && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="Gross" value={totals.gross} hint={totals.additions ? `incl. ${inr(totals.additions)} one-time` : undefined} />
          <Tile label="Net to pay" value={totals.net} hint={totals.reimbursements ? `incl. ${inr(totals.reimbursements)} reimbursed` : undefined} />
          <Tile label="Cost to company" value={totals.employerCost} hint="Gross + employer PF / ESI" />
          <Tile label="Deductions" value={totals.pfEmployee + totals.esiEmployee + totals.pt + totals.tds + totals.otherDeductions} hint={`TDS ${inr(totals.tds)} · PT ${inr(totals.pt)}`} />
          <Tile label="PF to deposit" value={totals.pfEmployee + totals.pfEmployer} hint={`Employee ${inr(totals.pfEmployee)} + employer ${inr(totals.pfEmployer)}`} />
          <Tile label="ESI to deposit" value={totals.esiEmployee + totals.esiEmployer} />
          <Tile label="Loan / other recovered" value={totals.otherDeductions} />
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">LOP days (all)</p>
            <p className="text-lg font-semibold tabular-nums">{totals.lopDays}</p>
          </div>
        </div>
      )}

      {items.adjustments.length > 0 && (
        <Card className="gap-0 py-0">
          <p className="border-b px-4 py-2 text-sm font-semibold">One-time items this month</p>
          <ul className="divide-y">
            {items.adjustments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className={cn("w-24 shrink-0 tabular-nums", a.kind === "deduction" ? "text-destructive" : "text-success")}>
                  {a.kind === "deduction" ? "−" : "+"} {inr(Number(a.amount))}
                </span>
                <span className="min-w-0 flex-1">
                  {a.employee_name} · {a.label}
                  <span className="text-xs text-muted-foreground"> · {ITEM_TYPES.find((t) => t.value === a.category)?.label}</span>
                </span>
                {canManage && draft && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${a.label}`} onClick={() => changed(() => payrollService.removeItem(selected.id, a.id), "Item removed")}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!payslips ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Paid days</TableHead>
                  <TableHead className="text-right">LOP</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">PF</TableHead>
                  <TableHead className="text-right">ESI</TableHead>
                  <TableHead className="text-right">PT</TableHead>
                  <TableHead className="text-right">TDS</TableHead>
                  <TableHead className="text-right">Other</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((p) => {
                  const ov = overrideOf(p.employee_id);
                  const expanded = open === p.id;
                  return (
                    <Fragment key={p.id}>
                      <TableRow className="cursor-pointer" onClick={() => setOpen(expanded ? null : p.id)}>
                        <TableCell className="font-medium">
                          {p.employee_name}
                          {p.designation && <span className="block text-xs font-normal text-muted-foreground">{p.designation}</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(p.paid_days)} / {p.total_days}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {canManage && draft ? (
                            <button
                              type="button"
                              className={cn("rounded px-1.5 py-0.5 underline decoration-dotted underline-offset-4 hover:bg-muted", Number(p.lop_days) > 0 && "text-destructive")}
                              onClick={(e) => (e.stopPropagation(), setLopFor(p))}
                              title={ov ? `Set by HR${ov.note ? ` — ${ov.note}` : ""}` : "From attendance — click to change"}
                            >
                              {Number(p.lop_days)}
                              {ov && "*"}
                            </button>
                          ) : (
                            <span className={cn(Number(p.lop_days) > 0 && "text-destructive")}>{Number(p.lop_days) || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{inr(p.gross)}</TableCell>
                        <TableCell className="text-right tabular-nums">{inr(p.pf_employee)}</TableCell>
                        <TableCell className="text-right tabular-nums">{inr(p.esi_employee)}</TableCell>
                        <TableCell className="text-right tabular-nums">{inr(p.professional_tax)}</TableCell>
                        <TableCell className="text-right tabular-nums">{inr(p.tds)}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(p.other_deductions) ? inr(p.other_deductions) : "—"}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{inr(p.net_pay)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon-sm" onClick={(e) => (e.stopPropagation(), download(p.id))} aria-label={`Download payslip of ${p.employee_name}`}>
                            <Download />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={11}>
                            <div className="grid gap-4 py-1 text-xs sm:grid-cols-2">
                              <div>
                                <p className="mb-1 font-semibold uppercase text-muted-foreground">Earnings</p>
                                {[...p.earnings, ...p.addition_lines].map((l, i) => (
                                  <p key={i} className="flex justify-between">
                                    <span>{l.label}</span>
                                    <span className="tabular-nums">{inr(l.amount)}</span>
                                  </p>
                                ))}
                              </div>
                              <div>
                                <p className="mb-1 font-semibold uppercase text-muted-foreground">Deductions</p>
                                {[
                                  { label: "PF", amount: Number(p.pf_employee) },
                                  { label: "ESI", amount: Number(p.esi_employee) },
                                  { label: "Professional tax", amount: Number(p.professional_tax) },
                                  { label: "TDS", amount: Number(p.tds) },
                                  ...p.deduction_lines,
                                ]
                                  .filter((l) => l.amount)
                                  .map((l, i) => (
                                    <p key={i} className="flex justify-between">
                                      <span>{l.label}</span>
                                      <span className="tabular-nums">{inr(l.amount)}</span>
                                    </p>
                                  ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {canManage && draft && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Click a row for its breakdown; click an LOP number to change it (* = set by HR).</p>}
        </Card>
      )}

      <ItemDialog open={adding} payslips={payslips ?? []} onClose={() => setAdding(false)} onSave={(b) => changed(() => payrollService.addItem(selected.id, b), "Added — payroll recalculated")} />
      <LopDialog
        slip={lopFor}
        override={lopFor ? overrideOf(lopFor.employee_id) : undefined}
        onClose={() => setLopFor(null)}
        onSave={(lopDays, note) => changed(() => payrollService.setLop(selected.id, { employeeId: lopFor!.employee_id, lopDays, note: note || undefined }), "LOP updated — payroll recalculated")}
      />
    </div>
  );
}

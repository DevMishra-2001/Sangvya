"use client";

// Loans and salary advances: recovered as a monthly EMI through payroll
import { Fragment, useCallback, useEffect, useState } from "react";
import { HandCoins, Plus } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { FormGrid } from "@/components/common/form-layout";
import { MonthPicker } from "@/components/common/month-picker";
import { SelectField } from "@/components/common/select-field";
import { StatTile } from "@/components/common/stat-tile";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { run } from "@/lib/api/run";
import { MONTHS } from "@/lib/constants";
import { inr, monthLabel, toMonth } from "@/lib/format";
import { payrollService } from "@/lib/services/payroll";
import type { EmployeeLoan } from "@/lib/types";
import { useCan } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";

type Data = Awaited<ReturnType<typeof payrollService.loans>>;
const nextMonth = () => {
  const d = new Date();
  return toMonth(new Date(d.getFullYear(), d.getMonth() + 1, 1));
};

function LoanDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const employees = useEmployeesStore((s) => s.list);
  const [employeeId, setEmployeeId] = useState("");
  const [kind, setKind] = useState<"loan" | "salary_advance">("salary_advance");
  const [principal, setPrincipal] = useState("");
  const [emi, setEmi] = useState("");
  const [start, setStart] = useState(nextMonth());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const months = Number(principal) && Number(emi) ? Math.ceil(Number(principal) / Number(emi)) : null;

  async function save() {
    setBusy(true);
    const r = await run(() => payrollService.createLoan({ employeeId: Number(employeeId), kind, principal: Number(principal), emi: Number(emi), startMonth: start, reason: reason || undefined }), { success: "Saved — EMI starts with that month's payroll" });
    setBusy(false);
    if (!r.ok) return;
    setPrincipal("");
    setEmi("");
    setReason("");
    onClose();
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New loan / advance</DialogTitle>
          <DialogDescription>Paid out by you; recovered automatically from salary every month until it&apos;s cleared.</DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          <FormField label="Employee" htmlFor="ln-emp" required span="full">
            <SelectField id="ln-emp" value={employeeId} onValueChange={setEmployeeId} placeholder="Pick an employee" options={employees.filter((e) => e.status !== "exited").map((e) => ({ value: String(e.id), label: `${e.name}${e.employee_code ? ` · ${e.employee_code}` : ""}` }))} />
          </FormField>
          <FormField label="Type" htmlFor="ln-kind" span="md">
            <SelectField
              id="ln-kind"
              value={kind}
              onValueChange={(v) => setKind(v as "loan")}
              options={[
                { value: "salary_advance", label: "Salary advance" },
                { value: "loan", label: "Loan" },
              ]}
            />
          </FormField>
          <FormField label="First EMI in" htmlFor="ln-start" span="md">
            <MonthPicker id="ln-start" value={start} onChange={setStart} allowFuture />
          </FormField>
          <FormField label="Amount (₹)" htmlFor="ln-amt" required span="md">
            <Input id="ln-amt" type="number" min={1} value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </FormField>
          <FormField label="EMI per month (₹)" htmlFor="ln-emi" required span="md" description={months ? `Cleared in ${months} month${months === 1 ? "" : "s"}` : undefined}>
            <Input id="ln-emi" type="number" min={1} value={emi} onChange={(e) => setEmi(e.target.value)} />
          </FormField>
          <FormField label="Reason" htmlFor="ln-reason" span="full">
            <Input id="ln-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </FormField>
        </FormGrid>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !employeeId || !(Number(principal) > 0) || !(Number(emi) > 0)}>
            {busy && <Spinner />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LoansTab() {
  const canManage = useCan()("payroll.manage");
  const [status, setStatus] = useState("active");
  const [data, setData] = useState<Data | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [recoveries, setRecoveries] = useState<Record<number, Awaited<ReturnType<typeof payrollService.recoveries>>>>({});

  const load = useCallback(async () => {
    const r = await run(() => payrollService.loans(status));
    if (r.ok) setData(r.data);
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    run(() => payrollService.loans(status)).then((r) => !cancelled && r.ok && setData(r.data));
    return () => {
      cancelled = true;
    };
  }, [status]);

  async function toggle(l: EmployeeLoan) {
    const next = openId === l.id ? null : l.id;
    setOpenId(next);
    if (next && !recoveries[l.id]) {
      const r = await run(() => payrollService.recoveries(l.id), { silent: true });
      if (r.ok) setRecoveries((m) => ({ ...m, [l.id]: r.data }));
    }
  }

  async function end(l: EmployeeLoan, to: "closed" | "cancelled") {
    const msg = to === "closed" ? `Mark ${l.employee_name}'s loan as settled? ${inr(Number(l.balance))} left won't be deducted.` : `Cancel ${l.employee_name}'s loan? No more EMIs will be deducted.`;
    if (!window.confirm(msg)) return;
    if ((await run(() => payrollService.updateLoan(l.id, { status: to }), { success: to === "closed" ? "Loan settled" : "Loan cancelled" })).ok) load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile icon={HandCoins} value={data?.totals.active ?? "—"} label="Active loans / advances" />
        <StatTile icon={HandCoins} value={data ? inr(Number(data.totals.outstanding)) : "—"} label="Still to recover" tone="bg-warning/15 text-warning" />
        <StatTile icon={HandCoins} value={data ? inr(Number(data.totals.monthlyEmi)) : "—"} label="Recovered each month" tone="bg-success/15 text-success" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="closed">Settled</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        {canManage && (
          <Button onClick={() => setAdding(true)}>
            <Plus /> New loan / advance
          </Button>
        )}
      </div>
      {data && !data.loans.length ? (
        <EmptyState icon={HandCoins} title="Nothing here" description="Loans and salary advances you give are recovered from salary automatically." />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">EMI</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead className="text-right">Recovered</TableHead>
                  <TableHead className="text-right">Left</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-44" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.loans.map((l) => (
                  <Fragment key={l.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggle(l)}>
                      <TableCell className="font-medium">
                        {l.employee_name}
                        {l.reason && <span className="block text-xs font-normal text-muted-foreground">{l.reason}</span>}
                      </TableCell>
                      <TableCell>{l.kind === "loan" ? "Loan" : "Salary advance"}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(Number(l.principal))}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(Number(l.emi))}</TableCell>
                      <TableCell>{monthLabel(l.start_month)}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(Number(l.recovered))}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{inr(Number(l.balance))}</TableCell>
                      <TableCell>
                        <StatusBadge tone={l.status === "active" ? "info" : l.status === "closed" ? "success" : "neutral"}>{l.status === "closed" ? "Settled" : l.status === "active" ? "Active" : "Cancelled"}</StatusBadge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {canManage && l.status === "active" && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => end(l, "closed")}>
                              Settle
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => end(l, "cancelled")}>
                              Cancel
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    {openId === l.id && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={9} className="text-xs">
                          {!recoveries[l.id] ? (
                            <Spinner />
                          ) : recoveries[l.id].length ? (
                            <span className="flex flex-wrap gap-x-4 gap-y-1">
                              {recoveries[l.id].map((r) => (
                                <span key={r.id}>
                                  {MONTHS[r.month - 1]} {r.year}: <strong className="tabular-nums">{inr(Number(r.amount))}</strong>
                                </span>
                              ))}
                            </span>
                          ) : (
                            "No EMI taken yet — the first one comes with a finalized payroll."
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
      <LoanDialog open={adding} onClose={() => setAdding(false)} onDone={load} />
    </div>
  );
}

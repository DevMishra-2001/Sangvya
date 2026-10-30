"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Download, Lock, Pencil, PlayCircle, Plus, RefreshCw, Wallet } from "lucide-react";
import { ConfirmAction, ConfirmDelete } from "@/components/common/confirm-button";
import { StatusBadge } from "@/components/common/status-badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { FormActions, FormCard, FormGrid } from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MONTHS } from "@/lib/constants";
import { inr } from "@/lib/format";
import { runPayrollSchema, type RunPayrollForm } from "@/lib/schemas/payroll";
import type { Employee, Id, PayrollSettings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { usePayrollStore } from "@/stores/payroll-store";
import { SalaryStructureDialog } from "./salary-structure-dialog";
import { FormSelect } from "@/components/common/select-field";

type RunOutput = z.output<typeof runPayrollSchema>;

function StructuresTab({ onEdit }: { onEdit: (e: Employee) => void }) {
  const canManage = useCan()("payroll.manage");
  const employees = useEmployeesStore((s) => s.list);
  const structures = usePayrollStore((s) => s.structures);

  if (employees.length === 0) return <EmptyState icon={Wallet} title="No employees yet" description='Add employees first from the "Employees" page.' />;

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">Set each employee&apos;s basic, HRA and allowances — payroll is calculated from these when you run it.</p>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Basic</TableHead>
              <TableHead className="text-right">HRA</TableHead>
              <TableHead className="text-right">Allowances</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              {canManage && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => {
              const s = structures.find((x) => x.employee_id === emp.id);
              const gross = s ? Number(s.basic) + Number(s.hra) + Number(s.allowances) : null;
              return (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(s?.basic)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(s?.hra)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(s?.allowances)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{inr(gross)}</TableCell>
                  {canManage && (
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" onClick={() => onEdit(emp)} aria-label={s ? `Edit salary of ${emp.name}` : `Set salary of ${emp.name}`}>
                        {s ? <Pencil /> : <Plus />}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function RunTab() {
  const canManage = useCan()("payroll.manage");
  const runs = usePayrollStore((s) => s.runs);
  const payslipsByRun = usePayrollStore((s) => s.payslipsByRun);
  const busy = usePayrollStore((s) => s.busy);
  const runPayroll = usePayrollStore((s) => s.runPayroll);
  const loadPayslips = usePayrollStore((s) => s.loadPayslips);
  const recalculate = usePayrollStore((s) => s.recalculate);
  const finalize = usePayrollStore((s) => s.finalize);
  const deleteRun = usePayrollStore((s) => s.deleteRun);
  const download = usePayrollStore((s) => s.download);
  const [selectedRunId, setSelectedRunId] = useState<Id | null>(null);
  const [now] = useState(() => new Date());
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RunPayrollForm, unknown, RunOutput>({
    resolver: zodResolver(runPayrollSchema),
    defaultValues: { month: String(now.getMonth() + 1), year: String(now.getFullYear()) },
  });

  useEffect(() => {
    if (selectedRunId) loadPayslips(selectedRunId);
  }, [selectedRunId, loadPayslips]);

  async function onRun({ month, year }: RunOutput) {
    const runId = await runPayroll(month, year);
    if (runId) setSelectedRunId(runId);
  }

  const selected = runs.find((r) => r.id === selectedRunId);
  const payslips = selectedRunId ? payslipsByRun[selectedRunId] : undefined;
  const draft = selected?.status === "draft";

  return (
    <div className="flex flex-col gap-5">
      {canManage && (
        <FormCard title="Run payroll" crumbs={["Payroll"]} icon={Wallet}>
          <form onSubmit={handleSubmit(onRun)} noValidate>
            <FormGrid>
              <FormField label="Month" htmlFor="run-month" error={errors.month}>
                <FormSelect control={control} name="month" id="run-month" options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
              </FormField>
              <FormField label="Year" htmlFor="run-year" error={errors.year}>
                <Input id="run-year" type="number" min={2000} max={2100} {...register("year")} />
              </FormField>
              <FormActions>
                <Button type="submit" disabled={busy}>
                  <PlayCircle /> {busy ? "Working…" : "Create draft"}
                </Button>
              </FormActions>
            </FormGrid>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            A draft uses each person&apos;s salary in effect that month. Working days without a check-in or approved leave are loss of pay; weekly offs and holidays are paid.
            Check it, recalculate after fixing attendance, then finalize — employees see their payslip once it&apos;s finalized.
          </p>
        </FormCard>
      )}

      <div className="flex flex-col gap-5 md:flex-row">
        <div className="flex w-full flex-col gap-1.5 md:w-52">
          <h2 className="text-sm font-semibold">Runs</h2>
          {runs.length === 0 && <p className="text-sm text-muted-foreground">No payroll runs yet.</p>}
          {runs.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedRunId(r.id)}
              aria-pressed={selectedRunId === r.id}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                selectedRunId === r.id ? "border-primary bg-primary/10 font-medium" : "bg-card hover:bg-accent",
              )}
            >
              {MONTHS[r.month - 1]} {r.year}
              <StatusBadge status={r.status === "draft" ? "pending" : "approved"} className="normal-case">
                {r.status === "draft" ? "Draft" : "Final"}
              </StatusBadge>
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {!selected ? (
            <EmptyState title="Select a run" description="Pick a payroll run on the left to see its payslips." />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
                <div>
                  <div className="font-semibold">
                    {MONTHS[selected.month - 1]} {selected.year} · {selected.employee_count} payslip{selected.employee_count === 1 ? "" : "s"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Gross {inr(selected.total_gross)} · Net {inr(selected.total_net)} ·{" "}
                    {draft ? "Draft — not visible to employees yet" : `Finalized ${selected.finalized_by_name ? `by ${selected.finalized_by_name}` : ""}`}
                  </div>
                </div>
                {canManage && draft && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => recalculate(selected.id)}>
                      <RefreshCw /> Recalculate
                    </Button>
                    <ConfirmAction
                      title={`Finalize ${MONTHS[selected.month - 1]} ${selected.year}?`}
                      description="It's locked after this, and every employee gets their payslip (in the app and by email)."
                      confirmLabel="Finalize"
                      onConfirm={() => finalize(selected.id)}
                    >
                      <Button size="sm" disabled={busy}>
                        <Lock /> Finalize
                      </Button>
                    </ConfirmAction>
                    <ConfirmDelete
                      title={`Delete the ${MONTHS[selected.month - 1]} draft?`}
                      onConfirm={async () => {
                        if (await deleteRun(selected.id)) setSelectedRunId(null);
                      }}
                      label="Delete draft"
                    />
                  </div>
                )}
              </div>
              {!payslips ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : payslips.length === 0 ? (
                <EmptyState title="No payslips in this run" />
              ) : (
                <Card className="py-0">
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
                        <TableHead className="text-right">Net pay</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payslips.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.employee_name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {Number(p.paid_days)} / {p.total_days}
                          </TableCell>
                          <TableCell className={cn("text-right tabular-nums", Number(p.lop_days) > 0 && "text-destructive")}>{Number(p.lop_days) || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{inr(p.gross)}</TableCell>
                          <TableCell className="text-right tabular-nums">{inr(p.pf_employee)}</TableCell>
                          <TableCell className="text-right tabular-nums">{inr(p.esi_employee)}</TableCell>
                          <TableCell className="text-right tabular-nums">{inr(p.professional_tax)}</TableCell>
                          <TableCell className="text-right tabular-nums">{inr(p.tds)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{inr(p.net_pay)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon-sm" onClick={() => download(p.id)} aria-label={`Download payslip of ${p.employee_name}`}>
                              <Download />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Which statutory deductions this company applies
function SettingsTab() {
  const canManage = useCan()("payroll.manage");
  const settings = usePayrollStore((s) => s.settings);
  const save = usePayrollStore((s) => s.saveSettings);
  if (!settings) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const rows: { key: keyof PayrollSettings; label: string; help: string }[] = [
    { key: "pfEnabled", label: "Provident Fund (PF)", help: "12% of basic (up to ₹15,000) from employee and employer" },
    { key: "esiEnabled", label: "ESI", help: "0.75% employee / 3.25% employer, for gross up to ₹21,000" },
    { key: "ptEnabled", label: "Professional tax", help: "₹0 / ₹150 / ₹200 by gross (common state slab)" },
    { key: "tdsEnabled", label: "TDS (income tax)", help: "Monthly estimate on the new regime" },
  ];
  return (
    <Card className="max-w-2xl gap-0 py-0">
      {rows.map((r, i) => (
        <label key={r.key} className={cn("flex cursor-pointer items-center justify-between gap-4 px-4 py-3", i > 0 && "border-t")}>
          <span>
            <span className="block text-sm font-medium">{r.label}</span>
            <span className="block text-xs text-muted-foreground">{r.help}</span>
          </span>
          <Switch checked={settings[r.key]} disabled={!canManage} onCheckedChange={(on) => save({ ...settings, [r.key]: on })} aria-label={r.label} />
        </label>
      ))}
      <p className="border-t px-4 py-3 text-xs text-muted-foreground">Changes apply to the next draft or recalculation; finalized runs don&apos;t change.</p>
    </Card>
  );
}

export function PayrollView() {
  const loadEmployees = useEmployeesStore((s) => s.load);
  const loadStructures = usePayrollStore((s) => s.loadStructures);
  const loadRuns = usePayrollStore((s) => s.loadRuns);
  const loadSettings = usePayrollStore((s) => s.loadSettings);
  const structures = usePayrollStore((s) => s.structures);
  const [editing, setEditing] = useState<Employee | null>(null);

  useEffect(() => {
    loadEmployees();
    loadStructures();
    loadRuns();
    loadSettings();
  }, [loadEmployees, loadStructures, loadRuns, loadSettings]);

  return (
    <div>
      <PageHeader title="Payroll" description="PF, ESI, professional tax and TDS are estimates — have them reviewed before paying real salaries." />
      <Tabs defaultValue="structure">
        <TabsList className="mb-4">
          <TabsTrigger value="structure">Salary structure</TabsTrigger>
          <TabsTrigger value="run">Run payroll</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="structure">
          <StructuresTab onEdit={setEditing} />
        </TabsContent>
        <TabsContent value="run">
          <RunTab />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
      <SalaryStructureDialog employee={editing} structure={structures.find((s) => s.employee_id === editing?.id)} onClose={() => setEditing(null)} />
    </div>
  );
}

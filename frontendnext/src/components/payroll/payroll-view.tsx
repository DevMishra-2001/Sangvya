"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Pencil, PlayCircle, Plus, Wallet } from "lucide-react";
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
import { fmtDate, inr } from "@/lib/format";
import { runPayrollSchema, type RunPayrollForm } from "@/lib/schemas/payroll";
import type { Employee, Id, PayrollSettings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { usePayrollStore } from "@/stores/payroll-store";
import { SalaryStructureDialog } from "./salary-structure-dialog";
import { LoansTab } from "./loans-tab";
import { RunDetail } from "./run-detail";
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
              <TableHead className="text-right">CTC / year</TableHead>
              <TableHead className="text-right">Basic</TableHead>
              <TableHead className="text-right">HRA</TableHead>
              <TableHead className="text-right">Other</TableHead>
              <TableHead className="text-right">Monthly gross</TableHead>
              <TableHead>Since</TableHead>
              {canManage && <TableHead className="w-28" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees
              .filter((e) => e.status !== "exited")
              .map((emp) => {
                const s = structures.find((x) => x.employee_id === emp.id);
                const gross = s ? Number(s.basic) + Number(s.hra) + Number(s.allowances) : null;
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">
                      {emp.name}
                      {emp.designation && <span className="block text-xs font-normal text-muted-foreground">{emp.designation}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s?.ctc_annual ? inr(Number(s.ctc_annual)) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{s ? inr(s.basic) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{s ? inr(s.hra) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums" title={s?.components?.map((c) => `${c.label}: ${c.amount}`).join("\n")}>
                      {s ? inr(s.allowances) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{gross == null ? <span className="text-warning">Not set</span> : inr(gross)}</TableCell>
                    <TableCell className="text-sm">{s ? fmtDate(s.effective_from) : "—"}</TableCell>
                    {canManage && (
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => onEdit(emp)}>
                          {s ? <Pencil /> : <Plus />} {s ? "Revise" : "Set salary"}
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
  const busy = usePayrollStore((s) => s.busy);
  const runPayroll = usePayrollStore((s) => s.runPayroll);
  const loadPayslips = usePayrollStore((s) => s.loadPayslips);
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

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <FormCard title="Run payroll" icon={Wallet}>
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

      <div className="flex flex-col gap-4 md:flex-row">
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
        {!selected ? (
          <div className="flex-1">
            <EmptyState title="Select a run" description="Pick a payroll run on the left to see its payslips." />
          </div>
        ) : (
          <RunDetail run={selected} onDeleted={() => setSelectedRunId(null)} />
        )}
      </div>
    </div>
  );
}

// Statutory deductions, PF wage rule and how a CTC is split
function SettingsTab() {
  const canManage = useCan()("payroll.manage");
  const settings = usePayrollStore((s) => s.settings);
  const save = usePayrollStore((s) => s.saveSettings);
  const [tpl, setTpl] = useState<PayrollSettings["ctcTemplate"] | null>(null);
  if (!settings) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const template = tpl ?? settings.ctcTemplate;
  const rows: { key: "pfEnabled" | "esiEnabled" | "ptEnabled" | "tdsEnabled" | "pfCeiling"; label: string; help: string }[] = [
    { key: "pfEnabled", label: "Provident Fund (PF)", help: "12% of basic from employee and employer" },
    { key: "pfCeiling", label: "Cap PF wage at ₹15,000", help: "Off = PF on the full basic" },
    { key: "esiEnabled", label: "ESI", help: "0.75% employee / 3.25% employer, for gross up to ₹21,000" },
    { key: "ptEnabled", label: "Professional tax", help: "₹0 / ₹150 / ₹200 by gross (common state slab)" },
    { key: "tdsEnabled", label: "TDS (income tax)", help: "Monthly estimate on the new regime" },
  ];
  const field = (key: keyof PayrollSettings["ctcTemplate"], label: string, help: string) => (
    <FormField label={label} htmlFor={`tpl-${key}`} description={help}>
      <Input id={`tpl-${key}`} type="number" min={0} value={String(template[key])} disabled={!canManage} onChange={(e) => setTpl({ ...template, [key]: Number(e.target.value) })} />
    </FormField>
  );
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="gap-0 py-0">
        <p className="border-b px-4 py-3 text-sm font-semibold">Deductions</p>
        {rows.map((r, i) => (
          <label key={r.key} className={cn("flex cursor-pointer items-center justify-between gap-4 px-4 py-3", i > 0 && "border-t")}>
            <span>
              <span className="block text-sm font-medium">{r.label}</span>
              <span className="block text-xs text-muted-foreground">{r.help}</span>
            </span>
            <Switch checked={settings[r.key]} disabled={!canManage || (r.key === "pfCeiling" && !settings.pfEnabled)} onCheckedChange={(on) => save({ ...settings, [r.key]: on })} aria-label={r.label} />
          </label>
        ))}
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">Changes apply to the next draft or recalculation; finalized runs don&apos;t change.</p>
      </Card>
      <FormCard title="CTC split" icon={Wallet}>
        <p className="mb-3 text-xs text-muted-foreground">Used by “Split” when you type a CTC in a salary. The rest goes to Special allowance.</p>
        <FormGrid density="dialog">
          {field("basicPct", "Basic (% of gross)", "Usually 40–50%")}
          {field("hraPctOfBasic", "HRA (% of basic)", "40% non-metro, 50% metro")}
          {field("conveyance", "Conveyance (₹/month)", "Fixed amount")}
          {field("medical", "Medical (₹/month)", "Fixed amount")}
          {canManage && (
            <FormActions>
              <Button disabled={!tpl} onClick={async () => (await save({ ...settings, ctcTemplate: template }), setTpl(null))}>
                Save split
              </Button>
            </FormActions>
          )}
        </FormGrid>
      </FormCard>
    </div>
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
      <Tabs defaultValue="run">
        <TabsList className="mb-4">
          <TabsTrigger value="run">Payroll runs</TabsTrigger>
          <TabsTrigger value="structure">Salary structure</TabsTrigger>
          <TabsTrigger value="loans">Loans &amp; advances</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="structure">
          <StructuresTab onEdit={setEditing} />
        </TabsContent>
        <TabsContent value="run">
          <RunTab />
        </TabsContent>
        <TabsContent value="loans">
          <LoansTab />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
      <SalaryStructureDialog employee={editing} structure={structures.find((s) => s.employee_id === editing?.id)} onClose={() => setEditing(null)} />
    </div>
  );
}

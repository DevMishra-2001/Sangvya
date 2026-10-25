"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Download, Pencil, PlayCircle, Plus, Wallet } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MONTHS } from "@/lib/constants";
import { inr } from "@/lib/format";
import { runPayrollSchema, type RunPayrollForm } from "@/lib/schemas/payroll";
import type { Employee, Id } from "@/lib/types";
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
  const running = usePayrollStore((s) => s.running);
  const runPayroll = usePayrollStore((s) => s.runPayroll);
  const loadPayslips = usePayrollStore((s) => s.loadPayslips);
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

  const payslips = selectedRunId ? payslipsByRun[selectedRunId] : undefined;

  return (
    <div className="flex flex-col gap-5">
      {canManage && (
        <Card>
          <CardContent>
            <form onSubmit={handleSubmit(onRun)} className="flex flex-wrap items-start gap-3" noValidate>
              <FormField label="Month" htmlFor="run-month" error={errors.month} className="w-44">
                <FormSelect control={control} name="month" id="run-month" options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
              </FormField>
              <FormField label="Year" htmlFor="run-year" error={errors.year} className="w-28">
                <Input id="run-year" type="number" min={2000} max={2100} {...register("year")} />
              </FormField>
              <Button type="submit" className="mt-6" disabled={running}>
                <PlayCircle /> {running ? "Running…" : "Run payroll"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-5 md:flex-row">
        <div className="flex w-full flex-col gap-1.5 md:w-48">
          <h2 className="text-sm font-semibold">Past runs</h2>
          {runs.length === 0 && <p className="text-sm text-muted-foreground">No payroll runs yet.</p>}
          {runs.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedRunId(r.id)}
              aria-pressed={selectedRunId === r.id}
              className={cn("rounded-lg border px-3 py-2 text-left text-sm transition-colors", selectedRunId === r.id ? "border-primary bg-primary/10 font-medium" : "bg-card hover:bg-accent")}
            >
              {MONTHS[r.month - 1]} {r.year}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          {!selectedRunId ? (
            <EmptyState title="Select a run" description="Pick a payroll run on the left to see its payslips." />
          ) : !payslips ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : payslips.length === 0 ? (
            <EmptyState title="No payslips in this run" />
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
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
        </div>
      </div>
    </div>
  );
}

export function PayrollView() {
  const loadEmployees = useEmployeesStore((s) => s.load);
  const loadStructures = usePayrollStore((s) => s.loadStructures);
  const loadRuns = usePayrollStore((s) => s.loadRuns);
  const structures = usePayrollStore((s) => s.structures);
  const [editing, setEditing] = useState<Employee | null>(null);

  useEffect(() => {
    loadEmployees();
    loadStructures();
    loadRuns();
  }, [loadEmployees, loadStructures, loadRuns]);

  return (
    <div>
      <PageHeader title="Payroll" description="PF, ESI, professional tax and TDS are estimates — have them reviewed before paying real salaries." />
      <Tabs defaultValue="structure">
        <TabsList className="mb-4">
          <TabsTrigger value="structure">Salary structure</TabsTrigger>
          <TabsTrigger value="run">Run payroll</TabsTrigger>
        </TabsList>
        <TabsContent value="structure">
          <StructuresTab onEdit={setEditing} />
        </TabsContent>
        <TabsContent value="run">
          <RunTab />
        </TabsContent>
      </Tabs>
      <SalaryStructureDialog employee={editing} structure={structures.find((s) => s.employee_id === editing?.id)} onClose={() => setEditing(null)} />
    </div>
  );
}

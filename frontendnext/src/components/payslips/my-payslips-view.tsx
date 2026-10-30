"use client";

import { useEffect, useState } from "react";
import { Download, Receipt } from "lucide-react";
import { EmptyState, NotLinkedState } from "@/components/common/empty-state";
import { FormHeading } from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { run } from "@/lib/api/run";
import { MONTHS } from "@/lib/constants";
import { inr } from "@/lib/format";
import { payrollService } from "@/lib/services/payroll";
import type { Id, MyPayslip } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUser } from "@/stores/auth-store";

const MONEY: { key: keyof MyPayslip; label: string }[] = [
  { key: "basic", label: "Basic" },
  { key: "hra", label: "HRA" },
  { key: "allowances", label: "Allowances" },
  { key: "gross", label: "Gross" },
  { key: "pf_employee", label: "PF" },
  { key: "esi_employee", label: "ESI" },
  { key: "professional_tax", label: "PT" },
  { key: "tds", label: "TDS" },
  { key: "total_deductions", label: "Deductions" },
];

// Employees: their finalized payslips, one row a month, with the PDF
export function MyPayslipsView() {
  const user = useUser();
  const [list, setList] = useState<MyPayslip[] | null>(null);
  const [downloading, setDownloading] = useState<Id | null>(null);

  useEffect(() => {
    if (!user.employee_id) return;
    run(payrollService.mine).then((r) => setList(r.ok ? r.data : []));
  }, [user.employee_id]);

  async function download(id: Id) {
    setDownloading(id);
    await run(() => payrollService.downloadMine(id), { error: "Could not download the payslip" });
    setDownloading(null);
  }

  if (!user.employee_id) return <NotLinkedState />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="My Payslips" description="Your payslips appear here once payroll for the month is finalized." className="mb-0" />
      {!list ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : list.length === 0 ? (
        <EmptyState icon={Receipt} title="No payslips yet" />
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card">
          <FormHeading title={`Payslips · ${list.length}`} />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Paid days</TableHead>
                  <TableHead className="text-right">LOP</TableHead>
                  {MONEY.map((m) => (
                    <TableHead key={m.key} className="text-right">
                      {m.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Net pay</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {MONTHS[p.month - 1]} {p.year}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(p.paid_days)} / {p.total_days}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", Number(p.lop_days) > 0 && "text-destructive")}>{Number(p.lop_days) || "—"}</TableCell>
                    {MONEY.map((m) => (
                      <TableCell key={m.key} className={cn("text-right tabular-nums", m.key === "gross" && "font-medium")}>
                        {inr(p[m.key] as string)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-semibold tabular-nums">{inr(p.net_pay)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" disabled={downloading === p.id} onClick={() => download(p.id)} aria-label={`Download ${MONTHS[p.month - 1]} ${p.year} payslip`}>
                        {downloading === p.id ? <Spinner /> : <Download />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}

import { and, asc, eq } from "drizzle-orm";
import { db } from "../../../config/db.js";
import { departments, employees, payrollRuns, payslips } from "../../../db/schema.js";
import type { ReportDef } from "../types.js";
import { departmentFilter, deptId, deptName, monthFilter, monthOf, subtitle } from "./common.js";

const MONEY = ["basic", "hra", "allowances", "gross", "pf_employee", "esi_employee", "professional_tax", "tds", "total_deductions", "net_pay", "pf_employer", "esi_employer"] as const;

export const payrollRegister: ReportDef = {
  key: "payroll-register",
  title: "Payroll register",
  description: "One month's payroll: every payslip's earnings, deductions, net pay and employer contributions.",
  group: "Payroll",
  permission: "reports.payroll",
  filters: [monthFilter("previousMonth"), departmentFilter],
  async build(companyId, filters) {
    const m = monthOf(filters);
    const dept = deptId(filters);
    const [run] = await db
      .select({ id: payrollRuns.id, status: payrollRuns.status })
      .from(payrollRuns)
      .where(and(eq(payrollRuns.company_id, companyId), eq(payrollRuns.month, m.monthNo), eq(payrollRuns.year, m.year)));
    const slips = run
      ? await db
          .select({
            name: employees.name,
            code: employees.employee_code,
            department: departments.name,
            paid_days: payslips.paid_days,
            lop_days: payslips.lop_days,
            ...Object.fromEntries(MONEY.map((k) => [k, payslips[k]])),
          })
          .from(payslips)
          .innerJoin(employees, eq(employees.id, payslips.employee_id))
          .leftJoin(departments, eq(departments.id, employees.department_id))
          .where(and(eq(payslips.payroll_run_id, run.id), dept ? eq(employees.department_id, dept) : undefined))
          .orderBy(asc(employees.name))
      : [];
    const rows = slips.map((s) => {
      const r = s as Record<string, unknown>;
      return {
        name: String(r.name),
        code: (r.code as string) ?? "",
        department: (r.department as string) ?? "",
        paid_days: Number(r.paid_days),
        lop_days: Number(r.lop_days),
        ...Object.fromEntries(MONEY.map((k) => [k, Number(r[k])])),
      };
    });
    const totals: Record<string, number | string> = { name: `Total (${rows.length})`, lop_days: rows.reduce((s, r) => s + r.lop_days, 0) };
    for (const k of MONEY) totals[k] = rows.reduce((s, r) => s + Number((r as unknown as Record<string, number>)[k]), 0);
    const money = (key: string, label: string, exportOnly = true) => ({ key, label, type: "money" as const, width: 12, exportOnly });
    return {
      title: "Payroll register",
      subtitle: subtitle(m.label, run ? (run.status === "draft" ? "DRAFT — not finalized" : "Finalized") : "No payroll run for this month", await deptName(companyId, dept)),
      columns: [
        { key: "name", label: "Employee", width: 22 },
        { key: "code", label: "Code", width: 10, exportOnly: true },
        { key: "department", label: "Department", width: 16, exportOnly: true },
        { key: "paid_days", label: "Paid days", type: "number", width: 9 },
        { key: "lop_days", label: "LOP", type: "number", width: 6 },
        money("basic", "Basic"),
        money("hra", "HRA"),
        money("allowances", "Allowances"),
        money("gross", "Gross", false),
        money("pf_employee", "PF"),
        money("esi_employee", "ESI"),
        money("professional_tax", "PT"),
        money("tds", "TDS"),
        money("total_deductions", "Deductions", false),
        money("net_pay", "Net pay", false),
        money("pf_employer", "PF (employer)"),
        money("esi_employer", "ESI (employer)"),
      ],
      rows,
      totals,
      fileName: `payroll-register-${m.month}`,
    };
  },
};

// Files HR needs after a payroll: salary register, bank transfer sheet, PF ECR (EPFO upload), ESI, PT and TDS sheets
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { companies, departments, designations, employeePrivate, employees, payrollRuns, payslips } from "../../db/schema.js";
import { NotFoundError } from "../../utils/httpErrors.js";
import { toXlsx } from "../reports/exporters/xlsx.js";
import type { Column, ReportResult } from "../reports/types.js";
import type { EXPORT_TYPES } from "./payroll.schema.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PF_WAGE_CEILING = 15000;
const EPS_RATE = 0.0833;
const n = (v: string | number | null | undefined) => Number(v ?? 0);

async function load(companyId: number, runId: number) {
  const [run] = await db
    .select({ id: payrollRuns.id, month: payrollRuns.month, year: payrollRuns.year, status: payrollRuns.status, company: companies.name })
    .from(payrollRuns)
    .innerJoin(companies, eq(companies.id, payrollRuns.company_id))
    .where(and(eq(payrollRuns.company_id, companyId), eq(payrollRuns.id, runId)));
  if (!run) throw new NotFoundError("Payroll run not found");
  const slips = await db
    .select({
      slip: payslips,
      name: employees.name,
      code: employees.employee_code,
      designation: designations.name,
      department: departments.name,
      uan: employeePrivate.uan,
      esi_number: employeePrivate.esi_number,
      pan: employeePrivate.pan,
      bank_name: employeePrivate.bank_name,
      ifsc: employeePrivate.ifsc,
      account_number: employeePrivate.account_number,
      account_holder: employeePrivate.account_holder,
    })
    .from(payslips)
    .innerJoin(employees, eq(employees.id, payslips.employee_id))
    .leftJoin(designations, eq(designations.id, employees.designation_id))
    .leftJoin(departments, eq(departments.id, employees.department_id))
    .leftJoin(employeePrivate, eq(employeePrivate.employee_id, employees.id))
    .where(eq(payslips.payroll_run_id, runId))
    .orderBy(asc(employees.name));
  return { run, slips, period: `${MONTHS[run.month - 1]} ${run.year}`, tag: `${run.year}-${String(run.month).padStart(2, "0")}` };
}

type Loaded = Awaited<ReturnType<typeof load>>;
const money = (key: string, label: string, width = 12): Column => ({ key, label, type: "money", width });
const textCol = (key: string, label: string, width = 18): Column => ({ key, label, width });
const draftNote = (l: Loaded) => (l.run.status === "draft" ? " · DRAFT (not final)" : "");

function register(l: Loaded): ReportResult {
  // Every earning name used this month becomes its own column
  const earningNames = [...new Set(l.slips.flatMap((s) => s.slip.earnings.map((e) => e.label)))];
  const columns: Column[] = [
    textCol("code", "Code", 10),
    textCol("name", "Employee", 22),
    textCol("designation", "Designation", 18),
    { key: "days", label: "Days", type: "number", width: 7 },
    { key: "paid", label: "Paid days", type: "number", width: 9 },
    { key: "lop", label: "LOP", type: "number", width: 7 },
    ...earningNames.map((e, i) => money(`e${i}`, e)),
    money("additions", "Bonus / other"),
    money("gross", "Gross"),
    money("pf", "PF"),
    money("esi", "ESI"),
    money("pt", "PT"),
    money("tds", "TDS"),
    money("other", "Other deductions", 14),
    money("reimb", "Reimbursements", 14),
    money("net", "Net pay"),
    money("pfEr", "Employer PF"),
    money("esiEr", "Employer ESI"),
  ];
  const rows = l.slips.map(({ slip, ...e }) => ({
    code: e.code ?? "",
    name: e.name,
    designation: e.designation ?? "",
    days: slip.total_days,
    paid: n(slip.paid_days),
    lop: n(slip.lop_days),
    ...Object.fromEntries(earningNames.map((name, i) => [`e${i}`, slip.earnings.find((x) => x.label === name)?.amount ?? 0])),
    additions: n(slip.additions),
    gross: n(slip.gross),
    pf: n(slip.pf_employee),
    esi: n(slip.esi_employee),
    pt: n(slip.professional_tax),
    tds: n(slip.tds),
    other: n(slip.other_deductions),
    reimb: n(slip.reimbursements),
    net: n(slip.net_pay),
    pfEr: n(slip.pf_employer),
    esiEr: n(slip.esi_employer),
  }));
  const totals: Record<string, number | string> = { name: "Total" };
  for (const c of columns) if (c.type === "money") totals[c.key] = rows.reduce((t, r) => t + n((r as unknown as Record<string, number>)[c.key]), 0);
  return { title: `Salary register — ${l.period}`, subtitle: `${rows.length} employees${draftNote(l)}`, columns, rows, totals, fileName: `salary-register-${l.tag}`, landscape: true };
}

function bank(l: Loaded): ReportResult {
  const rows = l.slips
    .filter((s) => n(s.slip.net_pay) > 0)
    .map((s) => ({
      code: s.code ?? "",
      name: s.account_holder || s.name,
      account: s.account_number ?? "MISSING",
      ifsc: s.ifsc ?? "MISSING",
      bank: s.bank_name ?? "",
      amount: n(s.slip.net_pay),
      remarks: `Salary ${l.period}`,
    }));
  const missing = rows.filter((r) => r.account === "MISSING" || r.ifsc === "MISSING").length;
  return {
    title: `Bank transfer — ${l.period}`,
    subtitle: `${rows.length} payments${missing ? ` · ${missing} without bank details` : ""}${draftNote(l)}`,
    columns: [textCol("code", "Code", 10), textCol("name", "Beneficiary name", 26), { key: "account", label: "Account number", type: "code", width: 20 }, { key: "ifsc", label: "IFSC", type: "code", width: 14 }, textCol("bank", "Bank", 20), money("amount", "Amount", 14), textCol("remarks", "Remarks", 22)],
    rows,
    totals: { name: "Total", amount: rows.reduce((t, r) => t + r.amount, 0) },
    fileName: `bank-transfer-${l.tag}`,
  };
}

function esi(l: Loaded): ReportResult {
  const rows = l.slips
    .filter((s) => n(s.slip.esi_employee) > 0 || n(s.slip.esi_employer) > 0)
    .map((s) => ({ ip: s.esi_number ?? "", name: s.name, days: n(s.slip.paid_days), wages: n(s.slip.gross), ee: n(s.slip.esi_employee), er: n(s.slip.esi_employer) }));
  return {
    title: `ESI contribution — ${l.period}`,
    subtitle: `${rows.length} insured employees${draftNote(l)}`,
    columns: [{ key: "ip", label: "IP number", type: "code", width: 16 }, textCol("name", "Name", 24), { key: "days", label: "Days paid", type: "number", width: 10 }, money("wages", "Wages", 14), money("ee", "Employee 0.75%", 14), money("er", "Employer 3.25%", 14)],
    rows,
    totals: { name: "Total", wages: rows.reduce((t, r) => t + r.wages, 0), ee: rows.reduce((t, r) => t + r.ee, 0), er: rows.reduce((t, r) => t + r.er, 0) },
    fileName: `esi-${l.tag}`,
  };
}

function pt(l: Loaded): ReportResult {
  const rows = l.slips.filter((s) => n(s.slip.professional_tax) > 0).map((s) => ({ code: s.code ?? "", name: s.name, gross: n(s.slip.gross), pt: n(s.slip.professional_tax) }));
  return {
    title: `Professional tax — ${l.period}`,
    subtitle: `${rows.length} employees${draftNote(l)}`,
    columns: [textCol("code", "Code", 10), textCol("name", "Name", 24), money("gross", "Gross", 14), money("pt", "PT", 10)],
    rows,
    totals: { name: "Total", gross: rows.reduce((t, r) => t + r.gross, 0), pt: rows.reduce((t, r) => t + r.pt, 0) },
    fileName: `professional-tax-${l.tag}`,
  };
}

function tds(l: Loaded): ReportResult {
  const rows = l.slips.filter((s) => n(s.slip.tds) > 0).map((s) => ({ code: s.code ?? "", name: s.name, pan: s.pan ?? "MISSING", gross: n(s.slip.gross), tds: n(s.slip.tds) }));
  return {
    title: `TDS on salary — ${l.period}`,
    subtitle: `${rows.length} employees${draftNote(l)}`,
    columns: [textCol("code", "Code", 10), textCol("name", "Name", 24), { key: "pan", label: "PAN", type: "code", width: 12 }, money("gross", "Gross", 14), money("tds", "TDS", 12)],
    rows,
    totals: { name: "Total", gross: rows.reduce((t, r) => t + r.gross, 0), tds: rows.reduce((t, r) => t + r.tds, 0) },
    fileName: `tds-${l.tag}`,
  };
}

// EPFO ECR 2.0 text: UAN#~#Name#~#Gross#~#EPF wages#~#EPS wages#~#EDLI wages#~#EE share#~#EPS share#~#ER diff#~#NCP days#~#Refunds
function pfEcr(l: Loaded) {
  const lines: string[] = [];
  const skipped: string[] = [];
  for (const s of l.slips) {
    const ee = n(s.slip.pf_employee);
    if (!ee) continue;
    if (!s.uan) {
      skipped.push(s.name);
      continue;
    }
    const gross = Math.round(n(s.slip.gross));
    // PF wage = basic, or ₹15,000 when the company caps it (whichever matches the PF taken)
    const basic = Math.round(n(s.slip.basic));
    const epfWages = Math.abs(Math.round(basic * 0.12) - ee) <= 1 ? basic : Math.min(basic, PF_WAGE_CEILING);
    const epsWages = Math.min(epfWages, PF_WAGE_CEILING);
    const eps = Math.round(epsWages * EPS_RATE);
    const er = Math.round(n(s.slip.pf_employer));
    lines.push([s.uan, s.name.toUpperCase(), gross, epfWages, epsWages, epsWages, ee, eps, Math.max(0, er - eps), Math.round(n(s.slip.lop_days)), 0].join("#~#"));
  }
  return { body: Buffer.from(lines.join("\n"), "utf8"), name: `pf-ecr-${l.tag}.txt`, skipped };
}

export async function exportRun(companyId: number, runId: number, type: (typeof EXPORT_TYPES)[number], printedBy?: string) {
  const l = await load(companyId, runId);
  if (type === "pf_ecr") {
    const f = pfEcr(l);
    return { body: f.body, name: f.name, contentType: "text/plain; charset=utf-8", skipped: f.skipped };
  }
  const report = { register, bank, esi, pt, tds }[type](l);
  return { body: await toXlsx(report, { company: l.run.company, printedBy }), name: `${report.fileName}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", skipped: [] as string[] };
}

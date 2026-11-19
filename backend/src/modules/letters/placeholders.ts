// The {{variables}} a letter can use, and filling them from the employee, salary and company
import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "../../config/db.js";
import { companies, salaryStructures } from "../../db/schema.js";
import { localDate } from "../../utils/workday.js";
import { getEmployeeById } from "../employees/employees.service.js";

export interface VariableDef {
  key: string;
  label: string;
  group: "Employee" | "Job" | "Salary" | "Company" | "Letter";
  block?: boolean; // a whole block (e.g. the salary table), not a word in a sentence
}

export const VARIABLES: VariableDef[] = [
  { key: "employee_name", label: "Employee name", group: "Employee" },
  { key: "employee_code", label: "Employee code", group: "Employee" },
  { key: "employee_email", label: "Email", group: "Employee" },
  { key: "employee_phone", label: "Phone", group: "Employee" },
  { key: "employee_address", label: "Address", group: "Employee" },
  { key: "designation", label: "Designation", group: "Job" },
  { key: "department", label: "Department", group: "Job" },
  { key: "branch", label: "Branch", group: "Job" },
  { key: "manager_name", label: "Reporting manager", group: "Job" },
  { key: "employment_type", label: "Employment type", group: "Job" },
  { key: "joining_date", label: "Joining date", group: "Job" },
  { key: "probation_end_date", label: "Probation end date", group: "Job" },
  { key: "confirmed_on", label: "Confirmed on", group: "Job" },
  { key: "last_working_day", label: "Last working day", group: "Job" },
  { key: "ctc_annual", label: "Annual CTC", group: "Salary" },
  { key: "ctc_annual_words", label: "Annual CTC in words", group: "Salary" },
  { key: "ctc_monthly", label: "Monthly CTC", group: "Salary" },
  { key: "basic_monthly", label: "Basic (monthly)", group: "Salary" },
  { key: "gross_monthly", label: "Gross (monthly)", group: "Salary" },
  { key: "salary_breakup", label: "Salary break-up table", group: "Salary", block: true },
  { key: "company_name", label: "Company name", group: "Company" },
  { key: "company_legal_name", label: "Legal name", group: "Company" },
  { key: "company_address", label: "Company address", group: "Company" },
  { key: "company_email", label: "Company email", group: "Company" },
  { key: "company_phone", label: "Company phone", group: "Company" },
  { key: "today", label: "Today's date", group: "Letter" },
  { key: "letter_number", label: "Letter number", group: "Letter" },
  { key: "signatory_name", label: "Signatory name", group: "Letter" },
  { key: "signatory_title", label: "Signatory title", group: "Letter" },
];
export const VARIABLE_KEYS = new Set(VARIABLES.map((x) => x.key));

// "2026-12-01" → "1 December 2026"
export const longDate = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "";
const rupees = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-IN")}`;

// 650000 → "Rupees Six Lakh Fifty Thousand only" (Indian numbering)
export function rupeesInWords(amount: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number) => (n < 20 ? ones[n]! : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`);
  const three = (n: number) => (n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${two(n % 100)}` : ""}` : two(n));
  let n = Math.round(amount);
  if (n === 0) return "Rupees Zero only";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1e3);
  n %= 1e3;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (n) parts.push(three(n));
  return `Rupees ${parts.join(" ")} only`;
}

export interface SalaryRow {
  label: string;
  monthly: number;
  annual: number;
}

export interface FilledValues {
  values: Record<string, string>;
  salaryRows: SalaryRow[];
}

// Everything known about the employee, their latest salary and the company, as text
export async function fillValues(companyId: number, employeeId: number): Promise<FilledValues> {
  const e = await getEmployeeById(companyId, employeeId);
  const [[company], [salary]] = await Promise.all([
    db.select().from(companies).where(eq(companies.id, companyId)),
    db
      .select()
      .from(salaryStructures)
      .where(and(eq(salaryStructures.company_id, companyId), eq(salaryStructures.employee_id, employeeId), lte(salaryStructures.effective_from, localDate())))
      .orderBy(desc(salaryStructures.effective_from), desc(salaryStructures.id))
      .limit(1),
  ]);
  const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(", ");

  const salaryRows: SalaryRow[] = [];
  if (salary) {
    const add = (label: string, monthly: number) => monthly > 0 && salaryRows.push({ label, monthly, annual: monthly * 12 });
    add("Basic", Number(salary.basic));
    add("HRA", Number(salary.hra));
    for (const c of salary.components ?? []) add(c.label, Number(c.amount));
    if (!salary.components?.length) add("Allowances", Number(salary.allowances));
  }
  const grossMonthly = salaryRows.reduce((s, r) => s + r.monthly, 0);
  const ctcAnnual = salary?.ctc_annual ? Number(salary.ctc_annual) : grossMonthly * 12;

  const values: Record<string, string> = {
    employee_name: e.name,
    employee_code: e.employee_code ?? "",
    employee_email: e.personal_email ?? e.email ?? "",
    employee_phone: e.phone ?? "",
    employee_address: join(e.address, e.address_line2, e.city, e.state && e.postal_code ? `${e.state} ${e.postal_code}` : e.state),
    designation: e.designation ?? "",
    department: e.department ?? "",
    branch: e.branch ?? "",
    manager_name: e.manager_name ?? "",
    employment_type: (e.employment_type ?? "").replace("_", " "),
    joining_date: longDate(e.join_date),
    probation_end_date: longDate(e.probation_end_date),
    confirmed_on: longDate(e.confirmed_on),
    last_working_day: longDate(e.exit_date),
    ctc_annual: ctcAnnual ? rupees(ctcAnnual) : "",
    ctc_annual_words: ctcAnnual ? rupeesInWords(ctcAnnual) : "",
    ctc_monthly: ctcAnnual ? rupees(ctcAnnual / 12) : "",
    basic_monthly: salary ? rupees(Number(salary.basic)) : "",
    gross_monthly: grossMonthly ? rupees(grossMonthly) : "",
    company_name: company?.name ?? "",
    company_legal_name: company?.legal_name ?? company?.name ?? "",
    company_address: join(company?.address, company?.city, company?.state, company?.postal_code),
    company_email: company?.email ?? "",
    company_phone: company?.phone ?? "",
    today: longDate(localDate()),
  };
  return { values, salaryRows };
}

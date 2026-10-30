// Helpers shared by the report definitions
import { and, asc, eq, gte, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../../config/db.js";
import { departments, designations, employees, shifts } from "../../../db/schema.js";
import type { FilterDef, Filters } from "../types.js";

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const monthFilter = (def: FilterDef["default"] = "currentMonth"): FilterDef => ({ key: "month", label: "Month", type: "month", required: true, default: def });
export const departmentFilter: FilterDef = { key: "departmentId", label: "Department", type: "select", optionsFrom: "departments" };

// "2026-10" → its days and a label
export function monthOf(filters: Filters) {
  const month = /^\d{4}-\d{2}$/.test(filters.month ?? "") ? filters.month! : new Date().toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { month, year: y, monthNo: m, days, start: `${month}-01`, end: `${month}-${String(days).padStart(2, "0")}`, label: `${MONTHS[m - 1]} ${y}` };
}

export const deptId = (filters: Filters) => (filters.departmentId && /^\d+$/.test(filters.departmentId) ? Number(filters.departmentId) : null);

export async function deptName(companyId: number, id: number | null) {
  if (!id) return null;
  const [d] = await db.select({ name: departments.name }).from(departments).where(and(eq(departments.company_id, companyId), eq(departments.id, id)));
  return d?.name ?? null;
}

const manager = alias(employees, "mgr");

// Employees with their names around them; `during` = employed at some point in [start, end]
export function peopleQuery(companyId: number, opts: { departmentId?: number | null; during?: { start: string; end: string }; where?: SQL }) {
  const conds: (SQL | undefined)[] = [eq(employees.company_id, companyId), opts.where];
  if (opts.departmentId) conds.push(eq(employees.department_id, opts.departmentId));
  if (opts.during) {
    conds.push(or(isNull(employees.join_date), lte(employees.join_date, opts.during.end)));
    conds.push(or(ne(employees.status, "exited"), isNull(employees.exit_date), gte(employees.exit_date, opts.during.start)));
  }
  return db
    .select({
      id: employees.id,
      name: employees.name,
      code: employees.employee_code,
      email: employees.email,
      phone: employees.phone,
      department: departments.name,
      designation: designations.name,
      shift: shifts.name,
      manager: manager.name,
      join_date: employees.join_date,
      created_at: sql<string>`(${employees.created_at} at time zone 'Asia/Kolkata')::date::text`,
      exit_date: employees.exit_date,
      status: employees.status,
      employment_type: employees.employment_type,
      role_id: employees.role_id,
    })
    .from(employees)
    .leftJoin(departments, eq(departments.id, employees.department_id))
    .leftJoin(designations, eq(designations.id, employees.designation_id))
    .leftJoin(shifts, eq(shifts.id, employees.shift_id))
    .leftJoin(manager, eq(manager.id, employees.manager_id))
    .where(and(...conds))
    .orderBy(asc(employees.name));
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const subtitle = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

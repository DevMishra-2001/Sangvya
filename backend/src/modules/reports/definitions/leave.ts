import { and, eq, gte, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../../config/db.js";
import { employees, leaveRequests, users } from "../../../db/schema.js";
import { localDate } from "../../../utils/workday.js";
import { getEmployeeById } from "../../employees/employees.service.js";
import { countLeaveDays, getBalances } from "../../leaves/leaveBalance.service.js";
import type { ReportDef } from "../types.js";
import { departmentFilter, deptId, deptName, peopleQuery, subtitle } from "./common.js";

const TYPES: Record<string, string> = { leave: "Leave", cl: "Casual (CL)", sl: "Sick (SL)", ol: "Optional (OL)", el: "Earned (EL)", comp_off: "Comp off" };
const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const leaveRequestsReport: ReportDef = {
  key: "leave-requests",
  title: "Leave requests",
  description: "All leave in a date range — type, days, status and who decided it.",
  group: "Leave",
  permission: "reports.leave",
  filters: [
    { key: "from", label: "From", type: "date", required: true, default: "monthStart" },
    { key: "to", label: "To", type: "date", required: true, default: "today" },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["pending", "approved", "rejected", "cancelled"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
    },
    { key: "type", label: "Type", type: "select", options: Object.entries(TYPES).map(([value, label]) => ({ value, label })) },
    departmentFilter,
  ],
  async build(companyId, filters) {
    const from = filters.from ?? localDate();
    const to = filters.to ?? localDate();
    const dept = deptId(filters);
    const reviewer = alias(users, "reviewer");
    const rows = await db
      .select({
        employee_id: leaveRequests.employee_id,
        name: employees.name,
        department_id: employees.department_id,
        type: leaveRequests.leave_type,
        from: leaveRequests.from_date,
        to: leaveRequests.to_date,
        half: leaveRequests.half_day,
        status: leaveRequests.status,
        reason: leaveRequests.reason,
        decided_by: reviewer.name,
      })
      .from(leaveRequests)
      .innerJoin(employees, eq(employees.id, leaveRequests.employee_id))
      .leftJoin(reviewer, eq(reviewer.id, leaveRequests.reviewed_by))
      .where(
        and(
          eq(leaveRequests.company_id, companyId),
          lte(leaveRequests.from_date, to),
          gte(leaveRequests.to_date, from),
          filters.status ? eq(leaveRequests.status, filters.status) : undefined,
          filters.type ? eq(leaveRequests.leave_type, filters.type) : undefined,
          dept ? eq(employees.department_id, dept) : undefined,
        ),
      )
      .orderBy(leaveRequests.from_date);
    const out = [];
    for (const r of rows) {
      out.push({
        name: r.name,
        type: TYPES[r.type] ?? r.type,
        from: r.from,
        to: r.to,
        days: await countLeaveDays(companyId, r.from, r.to, r.half),
        status: r.status[0].toUpperCase() + r.status.slice(1),
        decided_by: r.decided_by ?? "",
        reason: r.reason ?? "",
      });
    }
    return {
      title: "Leave requests",
      subtitle: subtitle(`${fmt(from)} – ${fmt(to)}`, filters.status, filters.type && TYPES[filters.type], await deptName(companyId, dept)),
      columns: [
        { key: "name", label: "Employee", width: 22 },
        { key: "type", label: "Type", width: 14 },
        { key: "from", label: "From", type: "date", width: 12 },
        { key: "to", label: "To", type: "date", width: 12 },
        { key: "days", label: "Days", type: "number", width: 7 },
        { key: "status", label: "Status", width: 11 },
        { key: "decided_by", label: "Decided by", width: 16, exportOnly: true },
        { key: "reason", label: "Reason", width: 30, exportOnly: true },
      ],
      rows: out,
      totals: { name: `Total (${out.length})`, days: out.reduce((s, r) => s + r.days, 0) },
      fileName: `leave-requests-${from}-to-${to}`,
    };
  },
};

export const leaveBalancesReport: ReportDef = {
  key: "leave-balances",
  title: "Leave balances",
  description: "Everyone's available leave today, by type (available / quota).",
  group: "Leave",
  permission: "reports.leave",
  filters: [departmentFilter],
  async build(companyId, filters) {
    const dept = deptId(filters);
    const today = localDate();
    const people = await peopleQuery(companyId, { departmentId: dept, during: { start: today, end: today } });
    const rows = [];
    let year = "";
    for (const p of people) {
      const b = await getBalances(companyId, await getEmployeeById(companyId, p.id), today);
      year = `${fmt(b.financialYear.start)} – ${fmt(b.financialYear.end)}`;
      const pair = (x: { available: number; quota: number }) => `${x.available} / ${x.quota}`;
      rows.push({ name: p.name, department: p.department ?? "", cl: pair(b.cl), sl: pair(b.sl), sl_carried: b.sl.carriedForward, ol: pair(b.ol), el: pair(b.el), comp_off: b.comp_off.available });
    }
    return {
      title: "Leave balances",
      subtitle: subtitle(`As of ${fmt(today)}`, year && `Leave year ${year}`, await deptName(companyId, dept)),
      columns: [
        { key: "name", label: "Employee", width: 24 },
        { key: "department", label: "Department", width: 18 },
        { key: "cl", label: "CL", type: "code", width: 9 },
        { key: "sl", label: "SL", type: "code", width: 9 },
        { key: "sl_carried", label: "SL carried", type: "number", width: 10, exportOnly: true },
        { key: "ol", label: "OL", type: "code", width: 9 },
        { key: "el", label: "EL (month)", type: "code", width: 10 },
        { key: "comp_off", label: "Comp off", type: "number", width: 9 },
      ],
      rows,
      fileName: `leave-balances-${today}`,
    };
  },
};

import { and, between, eq, gt, inArray, lte, gte } from "drizzle-orm";
import { db } from "../../../config/db.js";
import { attendance, holidays, leaveRequests } from "../../../db/schema.js";
import { localDate, localTime } from "../../../utils/workday.js";
import { workCalendar } from "../../companies/workCalendar.js";
import type { Cell, Column, ReportDef } from "../types.js";
import { departmentFilter, deptId, deptName, monthFilter, monthOf, peopleQuery, slug, subtitle } from "./common.js";

const LEAVE_CODE: Record<string, string> = { cl: "CL", sl: "SL", ol: "OL", el: "EL", comp_off: "CO", leave: "L" };

// P present · HD half day · A absent (LOP) · CL/SL… leave · WO weekly off · H holiday
export const attendanceRegister: ReportDef = {
  key: "attendance-register",
  title: "Attendance register",
  description: "Every employee's day-by-day attendance for a month, with present, leave, LOP and late totals.",
  group: "Attendance",
  permission: "reports.attendance",
  filters: [monthFilter("currentMonth"), departmentFilter],
  async build(companyId, filters) {
    const m = monthOf(filters);
    const dept = deptId(filters);
    const today = localDate();
    const [people, cal, hols] = await Promise.all([
      peopleQuery(companyId, { departmentId: dept, during: m }),
      workCalendar(companyId),
      db.select({ date: holidays.date }).from(holidays).where(and(eq(holidays.company_id, companyId), eq(holidays.is_optional, false), between(holidays.date, m.start, m.end))),
    ]);
    const ids = people.map((p) => p.id);
    const [days, leaves] = ids.length
      ? await Promise.all([
          db
            .select({ employee_id: attendance.employee_id, date: attendance.date, status: attendance.status, punch_in: attendance.punch_in, late: attendance.late_minutes })
            .from(attendance)
            .where(and(eq(attendance.company_id, companyId), inArray(attendance.employee_id, ids), between(attendance.date, m.start, m.end))),
          db
            .select({ employee_id: leaveRequests.employee_id, from: leaveRequests.from_date, to: leaveRequests.to_date, type: leaveRequests.leave_type, half: leaveRequests.half_day })
            .from(leaveRequests)
            .where(and(eq(leaveRequests.company_id, companyId), inArray(leaveRequests.employee_id, ids), eq(leaveRequests.status, "approved"), lte(leaveRequests.from_date, m.end), gte(leaveRequests.to_date, m.start))),
        ])
      : [[], []];
    const holidaySet = new Set(hols.map((h) => h.date));
    const dayKeys = Array.from({ length: m.days }, (_, i) => `${m.month}-${String(i + 1).padStart(2, "0")}`);

    const rows = people.map((p) => {
      const row: Record<string, Cell> = { name: p.name, code: p.code ?? "" };
      let present = 0, leave = 0, lop = 0, late = 0, off = 0;
      for (const day of dayKeys) {
        const col = `d${day.slice(8)}`;
        const joined = p.join_date ?? p.created_at; // no join date: from when they were added
        const outside = (joined && day < joined) || (p.status !== "active" && p.exit_date && day > p.exit_date);
        if (outside || day > today) {
          row[col] = "";
          continue;
        }
        if (cal.isWeeklyOff(day) || holidaySet.has(day)) {
          row[col] = holidaySet.has(day) ? "H" : "WO";
          off++;
          continue;
        }
        const a = days.find((d) => d.employee_id === p.id && d.date === day);
        const l = leaves.find((x) => x.employee_id === p.id && x.from <= day && x.to >= day);
        const worked = a?.punch_in || a?.status === "present" ? 1 : a?.status === "half" ? 0.5 : 0;
        const onLeave = l ? (l.half ? 0.5 : 1) : 0;
        if ((a?.late ?? 0) > 0) late++;
        present += worked;
        leave += Math.min(onLeave, 1 - worked);
        lop += Math.max(0, 1 - worked - onLeave);
        row[col] = worked === 1 ? "P" : l ? `${l.half ? "½" : ""}${LEAVE_CODE[l.type] ?? "L"}` : worked ? "HD" : "A";
      }
      Object.assign(row, { present, leave, lop, late, off });
      return row;
    });

    const columns: Column[] = [
      { key: "name", label: "Employee", width: 20 },
      { key: "code", label: "Code", width: 7, exportOnly: true },
      ...dayKeys.map((d) => ({ key: `d${d.slice(8)}`, label: String(Number(d.slice(8))), type: "code" as const, width: 4.6 })),
      { key: "present", label: "Present", type: "number" as const, width: 10 },
      { key: "leave", label: "Leave", type: "number" as const, width: 7 },
      { key: "lop", label: "LOP", type: "number" as const, width: 6 },
      { key: "late", label: "Late", type: "number" as const, width: 6 },
      { key: "off", label: "Off", type: "number" as const, width: 6 },
    ];
    const sum = (k: string) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
    return {
      title: "Attendance register",
      subtitle: subtitle(m.label, await deptName(companyId, dept), "P present · HD half day · A absent · WO weekly off · H holiday · CL/SL/OL/EL/CO leave"),
      columns,
      rows,
      totals: { name: `Total (${rows.length})`, present: sum("present"), leave: sum("leave"), lop: sum("lop"), late: sum("late"), off: sum("off") },
      landscape: true,
      fileName: `attendance-register-${m.month}`,
    };
  },
};

export const lateArrivals: ReportDef = {
  key: "late-arrivals",
  title: "Late arrivals",
  description: "Every late check-in in a month — when they came in and by how much.",
  group: "Attendance",
  permission: "reports.attendance",
  filters: [monthFilter("currentMonth"), departmentFilter],
  async build(companyId, filters) {
    const m = monthOf(filters);
    const dept = deptId(filters);
    const people = await peopleQuery(companyId, { departmentId: dept, during: m });
    const byId = new Map(people.map((p) => [p.id, p]));
    const lates = people.length
      ? await db
          .select({ employee_id: attendance.employee_id, date: attendance.date, punch_in: attendance.punch_in, late: attendance.late_minutes })
          .from(attendance)
          .where(and(eq(attendance.company_id, companyId), inArray(attendance.employee_id, [...byId.keys()]), between(attendance.date, m.start, m.end), gt(attendance.late_minutes, 0)))
          .orderBy(attendance.date)
      : [];
    const rows = lates.map((l) => {
      const p = byId.get(l.employee_id)!;
      return { date: l.date, name: p.name, department: p.department ?? "", shift: p.shift ?? "Company default", checked_in: l.punch_in ? localTime(l.punch_in) : "", late: l.late ?? 0 };
    });
    return {
      title: "Late arrivals",
      subtitle: subtitle(m.label, await deptName(companyId, dept), `${rows.length} late check-ins`),
      columns: [
        { key: "date", label: "Date", type: "date", width: 12 },
        { key: "name", label: "Employee", width: 24 },
        { key: "department", label: "Department", width: 18 },
        { key: "shift", label: "Shift", width: 16, exportOnly: true },
        { key: "checked_in", label: "Checked in", type: "code", width: 11 },
        { key: "late", label: "Late (min)", type: "number", width: 10 },
      ],
      rows,
      totals: { date: "Total", late: rows.reduce((s, r) => s + r.late, 0) },
      fileName: `late-arrivals-${m.month}${dept ? `-${slug((await deptName(companyId, dept)) ?? "")}` : ""}`,
    };
  },
};

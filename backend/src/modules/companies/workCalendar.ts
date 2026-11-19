// A company's working calendar, from its setup: which weekdays are working days (companies.work_days, e.g.
import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "../../config/db.js";
import { attendanceSettings, companies } from "../../db/schema.js";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DEFAULT_WORK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"]; // companies set up before work days existed

export interface WorkCalendar {
  leaveYearStartMonth: number; // 1 = Jan–Dec, 4 = Apr–Mar
  offDows: number[]; // weekly offs as day-of-week numbers (0 = Sunday)
  offSaturdays: number[]; // Saturdays off by week of the month (e.g. [2, 4]) when Saturday is a working day
  isWeeklyOff: (isoDate: string) => boolean;
  offDaySql: (dateColumn: SQL | unknown) => SQL; // the same test inside a query
  leaveYear: (isoDate: string) => { start: string; end: string; startYear: number };
}

export function makeCalendar(workDays: string[], leaveYearStartMonth: number, offSaturdays: number[] = []): WorkCalendar {
  const working = new Set(workDays.length ? workDays : DEFAULT_WORK_DAYS);
  const offDows = DAY_KEYS.map((k, i) => (working.has(k) ? -1 : i)).filter((i) => i >= 0);
  const satWeeks = working.has("sat") ? offSaturdays : [];
  const m = leaveYearStartMonth;
  return {
    leaveYearStartMonth: m,
    offDows,
    offSaturdays: satWeeks,
    isWeeklyOff: (isoDate) => {
      const dow = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
      return offDows.includes(dow) || (dow === 6 && satWeeks.includes(Math.ceil(Number(isoDate.slice(8, 10)) / 7)));
    },
    offDaySql: (col) => {
      const parts: SQL[] = [];
      if (offDows.length) parts.push(sql`extract(dow from ${col})::int in (${sql.join(offDows.map((d) => sql`${d}`), sql`, `)})`);
      if (satWeeks.length) parts.push(sql`(extract(dow from ${col})::int = 6 and ceil(extract(day from ${col}) / 7.0)::int in (${sql.join(satWeeks.map((w) => sql`${w}`), sql`, `)}))`);
      return parts.length ? sql`(${sql.join(parts, sql` or `)})` : sql`false`;
    },
    leaveYear: (isoDate) => {
      const [y, month] = isoDate.split("-").map(Number);
      const startYear = month >= m ? y : y - 1;
      const start = `${startYear}-${String(m).padStart(2, "0")}-01`;
      const endDate = new Date(Date.UTC(startYear + 1, m - 1, 0)); // the day before next year's start
      return { start, end: endDate.toISOString().slice(0, 10), startYear };
    },
  };
}

export async function workCalendar(companyId: number): Promise<WorkCalendar> {
  const [c] = await db
    .select({ work_days: companies.work_days, leave_year: companies.leave_year, off_saturdays: attendanceSettings.off_saturdays })
    .from(companies)
    .leftJoin(attendanceSettings, eq(attendanceSettings.company_id, companies.id))
    .where(eq(companies.id, companyId));
  const offSaturdays = (c?.off_saturdays ?? "").split(",").map(Number).filter((n) => n >= 1 && n <= 5);
  return makeCalendar(c?.work_days ? c.work_days.split(",") : DEFAULT_WORK_DAYS, c?.leave_year === "calendar" ? 1 : 4, offSaturdays);
}

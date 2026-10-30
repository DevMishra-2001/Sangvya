// A company's working calendar, from its setup: which weekdays are working days (companies.work_days, e.g.
import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { companies } from "../../db/schema.js";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DEFAULT_WORK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"]; // companies set up before work days existed

export interface WorkCalendar {
  leaveYearStartMonth: number; // 1 = Jan–Dec, 4 = Apr–Mar
  offDows: number[]; // weekly offs as day-of-week numbers (0 = Sunday)
  isWeeklyOff: (isoDate: string) => boolean;
  leaveYear: (isoDate: string) => { start: string; end: string; startYear: number };
}

export function makeCalendar(workDays: string[], leaveYearStartMonth: number): WorkCalendar {
  const working = new Set(workDays.length ? workDays : DEFAULT_WORK_DAYS);
  const offDows = DAY_KEYS.map((k, i) => (working.has(k) ? -1 : i)).filter((i) => i >= 0);
  const m = leaveYearStartMonth;
  return {
    leaveYearStartMonth: m,
    offDows,
    isWeeklyOff: (isoDate) => offDows.includes(new Date(`${isoDate}T00:00:00Z`).getUTCDay()),
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
  const [c] = await db.select({ work_days: companies.work_days, leave_year: companies.leave_year }).from(companies).where(eq(companies.id, companyId));
  return makeCalendar(c?.work_days ? c.work_days.split(",") : DEFAULT_WORK_DAYS, c?.leave_year === "calendar" ? 1 : 4);
}

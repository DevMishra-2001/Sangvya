// Working-day rules and helpers shared by punch in/out, the calendar and leave.
import { env } from "../config/env.js";

export const TIMEZONE = env.APP_TIMEZONE;
export const REQUIRED_MINUTES = env.REQUIRED_WORK_HOURS * 60; // punch in -> punch out, breaks included
export const MAX_BREAK_MINUTES = env.MAX_BREAK_MINUTES;

// "YYYY-MM-DD" for a moment, in the company's timezone (not the server's).
export function localDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

// "09:42" for a timestamp, in the company's timezone.
export function localTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" });
}

// "2026-10-29" + "09:30" in the company's timezone → the actual moment
export function zonedDateTime(isoDate: string, hhmm: string): Date {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // How far the timezone is from UTC at that moment (checked twice for DST edges)
  const offsetAt = (t: number) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(t));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - t;
  };
  let t = asUtc - offsetAt(asUtc);
  t = asUtc - offsetAt(t);
  return new Date(t);
}

export function isSunday(isoDate: string): boolean {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay() === 0;
}

// "2026-10" → { from: "2026-10-01", to: "2026-10-31" }
export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

const minutesBetween = (a: Date | string, b: Date | string) =>
  Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));

export interface DayTimes {
  punch_in: Date | null;
  punch_out: Date | null;
}

export interface BreakTimes {
  break_start: Date;
  break_end: Date | null;
}

export interface DaySummary {
  totalMinutes: number;
  breakMinutes: number;
  workMinutes: number;
  onBreak: boolean;
  shortDay: boolean;
  longBreak: boolean;
}

// Totals for one attendance row + its breaks. Open punches/breaks count up to `now`.
// The limits a day is judged by (from the employee's shift; defaults otherwise)
export interface DayRules {
  requiredMinutes: number;
  maxBreakMinutes: number;
}
const DEFAULT_RULES: DayRules = { requiredMinutes: REQUIRED_MINUTES, maxBreakMinutes: MAX_BREAK_MINUTES };

export function summarize(record: DayTimes | null | undefined, breaks: BreakTimes[], now: Date = new Date(), rules: DayRules = DEFAULT_RULES): DaySummary {
  if (!record?.punch_in) {
    return { totalMinutes: 0, breakMinutes: 0, workMinutes: 0, onBreak: false, shortDay: false, longBreak: false };
  }
  const end = record.punch_out || now;
  const totalMinutes = minutesBetween(record.punch_in, end);
  const breakMinutes = breaks.reduce((sum, b) => sum + minutesBetween(b.break_start, b.break_end || end), 0);
  return {
    totalMinutes,
    breakMinutes,
    workMinutes: Math.max(0, totalMinutes - breakMinutes),
    onBreak: !record.punch_out && breaks.some((b) => !b.break_end),
    // Only judged once the day is closed
    shortDay: Boolean(record.punch_out) && totalMinutes < rules.requiredMinutes,
    longBreak: breakMinutes > rules.maxBreakMinutes,
  };
}

export function formatMinutes(min: number): string {
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

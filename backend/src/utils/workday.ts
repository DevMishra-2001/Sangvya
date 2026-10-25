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
export function summarize(record: DayTimes | null | undefined, breaks: BreakTimes[], now: Date = new Date()): DaySummary {
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
    shortDay: Boolean(record.punch_out) && totalMinutes < REQUIRED_MINUTES,
    longBreak: breakMinutes > MAX_BREAK_MINUTES,
  };
}

export function formatMinutes(min: number): string {
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

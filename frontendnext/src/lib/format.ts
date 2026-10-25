// Display helpers for dates, times, durations and money.
import type { AttendanceDay } from "./types";

// "YYYY-MM-DD" for a local Date
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Date → "YYYY-MM" (local)
export function toMonth(d: Date): string {
  return isoDate(d).slice(0, 7);
}

// "2026-10" → "Oct-2026"
export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" }).replace(" ", "-");
}

// "2026-10" + n months
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  return toMonth(new Date(y, m - 1 + n, 1));
}

// "09:42" in the viewer's local time
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// 545 → "9h 05m"
export function fmtMinutes(min: number | null | undefined): string {
  if (min == null) return "—";
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

// 205 → "03:25"
export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// "2026-10-24" → "24 Oct 2026"
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// "2026-10-24" → "24 Oct 2026" (Indian style, no leading zero)
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export const weekday = (iso: string, style: "long" | "short" = "long") =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: style });

export const inr = (n: string | number | null | undefined) => (n == null || n === "" ? "—" : `₹${Number(n).toLocaleString("en-IN")}`);

const minutesBetween = (a: string | Date, b: string | Date) =>
  Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));

// Recomputes a day's totals up to `now` so a running shift/break ticks live
export function liveTotals(day: AttendanceDay | null | undefined, now = new Date()) {
  if (!day?.punchIn) return { totalMinutes: 0, breakMinutes: 0, workMinutes: 0 };
  const end = day.punchOut || now;
  const totalMinutes = minutesBetween(day.punchIn, end);
  const breakMinutes = day.breaks.reduce((sum, b) => sum + minutesBetween(b.start, b.end || end), 0);
  return { totalMinutes, breakMinutes, workMinutes: Math.max(0, totalMinutes - breakMinutes) };
}

export function timeAgo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// Display helpers for punch times, durations and leave types.

export const LEAVE_TYPE_LABELS = {
  leave: "Leave",
  cl: "Casual Leave (CL)",
  sl: "Sick Leave (SL)",
  ol: "Optional Leave (OL)",
  el: "Earned Leave (EL)",
  comp_off: "Comp Off",
};

export const SHORT_LEAVE_LABELS = { leave: "Leave", cl: "CL", sl: "SL", ol: "OL", el: "EL", comp_off: "Comp Off" };

// Leave types an employee can apply for on a working day.
// Comp off is earned automatically by checking in on a Sunday/holiday.
export const APPLY_LEAVE_TYPES = ["cl", "sl", "ol", "el", "comp_off"];

// Leave types that have a balance (shown as "available" counters)
export const BALANCE_TYPES = ["cl", "sl", "ol", "el", "comp_off"];

// "09:42" in the viewer's local time
export function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// 545 -> "9h 05m"
export function fmtMinutes(min) {
  if (min == null) return "—";
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

const minutesBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));

// Recomputes a day's totals up to `now` so a running shift/break ticks live.
export function liveTotals(day, now = new Date()) {
  if (!day?.punchIn) return { totalMinutes: 0, breakMinutes: 0, workMinutes: 0 };
  const end = day.punchOut || now;
  const totalMinutes = minutesBetween(day.punchIn, end);
  const breakMinutes = day.breaks.reduce((sum, b) => sum + minutesBetween(b.start, b.end || end), 0);
  return { totalMinutes, breakMinutes, workMinutes: Math.max(0, totalMinutes - breakMinutes) };
}

// "YYYY-MM-DD" for a local Date
export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

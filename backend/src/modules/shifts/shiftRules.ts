// Working-hours rules from the employee's shift (else company default / office hours)
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../config/db.js";
import { companies, employees, shifts } from "../../db/schema.js";
import { MAX_BREAK_MINUTES, REQUIRED_MINUTES, TIMEZONE } from "../../utils/workday.js";

export interface ShiftRules {
  shiftId: number | null;
  shiftName: string;
  start: string; // "09:00"
  end: string; // "18:00" (earlier than start = overnight)
  graceMinutes: number;
  requiredMinutes: number; // check-in → check-out, breaks included
  maxBreakMinutes: number;
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// 09:00 → 18:00 = 540; 22:00 → 07:00 = 540 (overnight)
export const shiftLength = (start: string, end: string) => {
  const d = toMinutes(end) - toMinutes(start);
  return d > 0 ? d : d + 1440;
};

type ShiftRow = typeof shifts.$inferSelect;
const fromShift = (s: ShiftRow): ShiftRules => ({
  shiftId: s.id,
  shiftName: s.name,
  start: s.start_time,
  end: s.end_time,
  graceMinutes: s.grace_minutes,
  requiredMinutes: shiftLength(s.start_time, s.end_time),
  maxBreakMinutes: s.break_minutes,
});

async function companyFallback(companyId: number): Promise<ShiftRules> {
  const [c] = await db.select({ start: companies.office_start, end: companies.office_end }).from(companies).where(eq(companies.id, companyId));
  const start = c?.start ?? "09:00";
  const end = c?.end ?? null;
  return {
    shiftId: null,
    shiftName: "Office hours",
    start,
    end: end ?? start,
    graceMinutes: 0,
    requiredMinutes: end ? shiftLength(start, end) : REQUIRED_MINUTES,
    maxBreakMinutes: MAX_BREAK_MINUTES,
  };
}

// Rules for several employees at once (id → rules)
export async function rulesForEmployees(companyId: number, employeeIds: number[]): Promise<Map<number, ShiftRules>> {
  const result = new Map<number, ShiftRules>();
  if (!employeeIds.length) return result;
  const [people, companyShifts] = await Promise.all([
    db.select({ id: employees.id, shift_id: employees.shift_id }).from(employees).where(and(eq(employees.company_id, companyId), inArray(employees.id, employeeIds))),
    db.select().from(shifts).where(eq(shifts.company_id, companyId)),
  ]);
  const byId = new Map(companyShifts.map((s) => [s.id, s]));
  const def = companyShifts.find((s) => s.is_default);
  const fallback = def ? fromShift(def) : await companyFallback(companyId);
  for (const p of people) {
    const own = p.shift_id ? byId.get(p.shift_id) : undefined;
    result.set(p.id, own ? fromShift(own) : fallback);
  }
  return result;
}

export async function rulesFor(companyId: number, employeeId: number): Promise<ShiftRules> {
  return (await rulesForEmployees(companyId, [employeeId])).get(employeeId) ?? (await companyFallback(companyId));
}

// Minutes late for a check-in at `at` (0 = on time, including the grace time).
export function lateMinutes(rules: ShiftRules, at: Date) {
  const local = at.toLocaleTimeString("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  let diff = toMinutes(local) - toMinutes(rules.start);
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff > rules.graceMinutes ? diff : 0;
}

// What the browser shows about the rules
export const rulesPayload = (r: ShiftRules) => ({
  shiftName: r.shiftName,
  start: r.start,
  end: r.end,
  graceMinutes: r.graceMinutes,
  requiredMinutes: r.requiredMinutes,
  maxBreakMinutes: r.maxBreakMinutes,
});

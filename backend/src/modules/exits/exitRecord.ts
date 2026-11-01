// The exit record + clearance checklist, created when an exit starts and dropped if it's cancelled
import { and, eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { employeeExits, exitClearances } from "../../db/schema.js";
import { localDate } from "../../utils/workday.js";

export const CLEARANCE_ITEMS = [
  { key: "handover", label: "Work handed over" },
  { key: "it_access", label: "IT access revoked (email, systems)" },
  { key: "id_card", label: "ID / access card returned" },
  { key: "finance_dues", label: "No dues — advances, loans settled" },
  { key: "manager_signoff", label: "Manager sign-off" },
  { key: "hr_signoff", label: "HR sign-off" },
] as const;

export async function ensureExitRecord(companyId: number, employeeId: number) {
  await db.insert(employeeExits).values({ employee_id: employeeId, company_id: companyId, started_on: localDate() }).onConflictDoNothing();
  await db
    .insert(exitClearances)
    .values(CLEARANCE_ITEMS.map((i) => ({ company_id: companyId, employee_id: employeeId, item_key: i.key, label: i.label })))
    .onConflictDoNothing();
}

export async function dropExitRecord(companyId: number, employeeId: number) {
  await db.delete(exitClearances).where(and(eq(exitClearances.company_id, companyId), eq(exitClearances.employee_id, employeeId)));
  await db.delete(employeeExits).where(and(eq(employeeExits.company_id, companyId), eq(employeeExits.employee_id, employeeId)));
}

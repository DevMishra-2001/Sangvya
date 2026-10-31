import { and, eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { employeePrivate } from "../../db/schema.js";
import type { PrivateInput } from "./employees.schema.js";

const columns = (p: PrivateInput) => ({
  pan: p.pan ?? null,
  aadhaar: p.aadhaar ?? null,
  uan: p.uan ?? null,
  pf_number: p.pfNumber ?? null,
  esi_number: p.esiNumber ?? null,
  passport_number: p.passportNumber ?? null,
  bank_name: p.bankName ?? null,
  bank_branch: p.bankBranch ?? null,
  ifsc: p.ifsc ?? null,
  account_number: p.accountNumber ?? null,
  account_holder: p.accountHolder ?? null,
  account_type: p.accountType ?? null,
});

// Statutory IDs + bank for one employee (HR / Admin only)
export async function getPrivate(companyId: number, employeeId: number) {
  const [row] = await db
    .select()
    .from(employeePrivate)
    .where(and(eq(employeePrivate.company_id, companyId), eq(employeePrivate.employee_id, employeeId)));
  return row ?? null;
}

// Full replace (the form sends every field)
export async function savePrivate(companyId: number, employeeId: number, input: PrivateInput) {
  const values = { ...columns(input), updated_at: new Date() };
  await db
    .insert(employeePrivate)
    .values({ employee_id: employeeId, company_id: companyId, ...values })
    .onConflictDoUpdate({ target: employeePrivate.employee_id, set: values });
}

// Only the fields given (onboarding link): blanks don't wipe what HR already entered
export async function mergePrivate(companyId: number, employeeId: number, input: PrivateInput) {
  const current = await getPrivate(companyId, employeeId);
  const next = columns(input);
  const merged = Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v ?? current?.[k as keyof typeof next] ?? null])) as typeof next;
  await db
    .insert(employeePrivate)
    .values({ employee_id: employeeId, company_id: companyId, ...merged, updated_at: new Date() })
    .onConflictDoUpdate({ target: employeePrivate.employee_id, set: { ...merged, updated_at: new Date() } });
}

// Is a company suspended? Checked on every company API call (scopeToCompany),
// so it's cached briefly and cleared whenever the Super Admin changes it.
import { eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { companies } from "../db/schema.js";

const CACHE_MS = 30_000;
const cache = new Map<number, { suspended: boolean; at: number }>();

export async function isCompanySuspended(companyId: number) {
  const hit = cache.get(companyId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.suspended;
  const [row] = await db.select({ status: companies.status }).from(companies).where(eq(companies.id, companyId));
  const suspended = row?.status === "suspended";
  cache.set(companyId, { suspended, at: Date.now() });
  return suspended;
}

export function forgetCompanyStatus(companyId: number) {
  cache.delete(companyId);
}

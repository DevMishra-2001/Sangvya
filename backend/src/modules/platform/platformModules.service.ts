// Super Admin: switch modules on/off for a company. Takes effect on the
// company's next request (the access cache is cleared).
import { eq, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { MODULES } from "../../config/modules.js";
import { companies, companyModules } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { NotFoundError } from "../../utils/httpErrors.js";
import { clearAccessCache, disabledModules } from "../pages/access.service.js";
import type { ModulesInput } from "./platform.schema.js";

export async function companyModuleStates(companyId: number) {
  const off = await disabledModules(companyId);
  return MODULES.map(({ key, name, description }) => ({ key, name, description, enabled: !off.has(key) }));
}

export async function setCompanyModules(actor: Express.AuthUser, companyId: number, { modules }: ModulesInput) {
  const [company] = await db.select({ id: companies.id, name: companies.name }).from(companies).where(eq(companies.id, companyId));
  if (!company) throw new NotFoundError("Company not found");

  const before = await disabledModules(companyId);
  const changed = Object.entries(modules).filter(([key, on]) => before.has(key) === on);
  if (changed.length) {
    await db
      .insert(companyModules)
      .values(changed.map(([key, on]) => ({ company_id: companyId, module_key: key, is_enabled: on })))
      .onConflictDoUpdate({
        target: [companyModules.company_id, companyModules.module_key],
        set: { is_enabled: sql`excluded.is_enabled`, updated_at: new Date() },
      });
    clearAccessCache();
    const name = (k: string) => MODULES.find((m) => m.key === k)?.name ?? k;
    for (const [key, on] of changed) {
      audit(actor, {
        companyId,
        action: on ? "module.enabled" : "module.disabled",
        target: ["company", companyId],
        summary: `${on ? "Switched on" : "Switched off"} ${name(key)} for ${company.name}`,
        meta: { module: key },
      });
    }
  }
  return { modules: await companyModuleStates(companyId) };
}

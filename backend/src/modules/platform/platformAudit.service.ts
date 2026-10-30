// Super Admin: the audit log — newest first, filtered by action, company or a
// search over the summary / actor email, paged with a cursor (last row's id).
import { and, desc, eq, ilike, like, lt, or, type SQL } from "drizzle-orm";
import { db } from "../../config/db.js";
import { auditLogs, companies } from "../../db/schema.js";
import type { AuditQuery } from "./platform.schema.js";

export async function listAudit({ action, companyId, q, before, limit }: AuditQuery) {
  const where: SQL[] = [];
  // "company" matches every company.* action; "company.suspended" just that one
  if (action) where.push(action.includes(".") ? eq(auditLogs.action, action) : like(auditLogs.action, `${action}.%`));
  if (companyId) where.push(eq(auditLogs.company_id, companyId));
  if (q) where.push(or(ilike(auditLogs.summary, `%${q}%`), ilike(auditLogs.actor_email, `%${q}%`))!);
  if (before) where.push(lt(auditLogs.id, before));

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      summary: auditLogs.summary,
      actor_email: auditLogs.actor_email,
      company_id: auditLogs.company_id,
      company_name: companies.name,
      target_type: auditLogs.target_type,
      target_id: auditLogs.target_id,
      meta: auditLogs.meta,
      created_at: auditLogs.created_at,
    })
    .from(auditLogs)
    .leftJoin(companies, eq(companies.id, auditLogs.company_id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(auditLogs.id))
    .limit(limit + 1);
  const more = rows.length > limit;
  const entries = more ? rows.slice(0, limit) : rows;
  return { entries, nextCursor: more ? entries[entries.length - 1].id : null };
}

// Super Admin: the audit log — newest first, filtered by action, company or a search over the summary / actor email, paged with a cursor (last row's id).
import { and, desc, eq, ilike, like, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../config/db.js";
import { auditLogs, companies } from "../../db/schema.js";
import { toXlsx } from "../reports/exporters/xlsx.js";
import type { ReportResult } from "../reports/types.js";
import type { AuditQuery } from "./platform.schema.js";

// Filters shared by the list and the Excel export
function filters({ action, companyId, q, from, to }: AuditQuery) {
  const where: SQL[] = [];
  // "company" matches every company.* action; "company.suspended" just that one
  if (action) where.push(action.includes(".") ? eq(auditLogs.action, action) : like(auditLogs.action, `${action}.%`));
  if (companyId) where.push(eq(auditLogs.company_id, companyId));
  if (q) where.push(or(ilike(auditLogs.summary, `%${q}%`), ilike(auditLogs.actor_email, `%${q}%`))!);
  // Dates are Indian dates (whole days)
  if (from) where.push(sql`${auditLogs.created_at} >= ${from}::date::timestamp at time zone 'Asia/Kolkata'`);
  if (to) where.push(sql`${auditLogs.created_at} < (${to}::date + 1)::timestamp at time zone 'Asia/Kolkata'`);
  return where;
}

export async function listAudit(query: AuditQuery) {
  const { before, limit } = query;
  const where = filters(query);
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

const EXPORT_LIMIT = 10000;

// Same filters → Excel (newest first, up to 10,000 rows)
export async function exportAudit(query: AuditQuery) {
  const where = filters(query);
  const rows = await db
    .select({ created_at: auditLogs.created_at, company: companies.name, actor: auditLogs.actor_email, action: auditLogs.action, summary: auditLogs.summary })
    .from(auditLogs)
    .leftJoin(companies, eq(companies.id, auditLogs.company_id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(auditLogs.id))
    .limit(EXPORT_LIMIT);
  const when = (d: Date | null) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "");
  const words = [query.from && `from ${query.from}`, query.to && `to ${query.to}`, query.action && `action: ${query.action}`, query.q && `search: "${query.q}"`].filter(Boolean).join(" · ");
  return toXlsx(
    {
      title: "Audit log",
      subtitle: `${rows.length} entries${words ? ` · ${words}` : ""}${rows.length === EXPORT_LIMIT ? " (first 10,000)" : ""}`,
      columns: [
        { key: "when", label: "When", width: 22 },
        { key: "company", label: "Company", width: 24 },
        { key: "actor", label: "By", width: 28 },
        { key: "action", label: "Action", width: 24 },
        { key: "summary", label: "What happened", width: 70 },
      ],
      rows: rows.map((r) => ({ when: when(r.created_at), company: r.company ?? "Platform", actor: r.actor ?? "System", action: r.action, summary: r.summary })),
      fileName: "audit-log",
    } as ReportResult,
    { company: "Workkind platform" },
  );
}

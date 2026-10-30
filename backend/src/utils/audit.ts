// Records a major event in the audit log (never fails the request)
import { db } from "../config/db.js";
import { auditLogs } from "../db/schema.js";

export interface AuditActor {
  id: number;
  email?: string | null;
}

export interface AuditEntry {
  action: string;
  summary: string;
  companyId?: number | null;
  target?: [type: string, id: number];
  meta?: Record<string, unknown>;
}

export function audit(actor: AuditActor | null | undefined, entry: AuditEntry) {
  void db
    .insert(auditLogs)
    .values({
      actor_id: actor?.id ?? null,
      actor_email: actor?.email ?? null,
      company_id: entry.companyId ?? null,
      action: entry.action,
      target_type: entry.target?.[0] ?? null,
      target_id: entry.target?.[1] ?? null,
      summary: entry.summary,
      meta: entry.meta ?? null,
    })
    .catch((err: Error) => console.error("Audit log write failed:", err.message));
}

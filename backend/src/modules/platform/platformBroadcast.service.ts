// Super Admin: send a message to companies — their admins or everyone — as a bell notification and optionally email
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../config/db.js";
import { auditLogs, companies, companyMembers, employees, roles, users } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError } from "../../utils/httpErrors.js";
import { notify } from "../notifications/notify.js";

const MAX_EMAILS = 2000;

export const broadcastSchema = z.object({
  title: z.string().trim().min(3, "Add a title").max(150),
  message: z.string().trim().min(3, "Write the message").max(2000),
  audience: z.enum(["admins", "everyone"]),
  companyIds: z.array(z.coerce.number().int().positive()).max(500).default([]), // empty = every active company
  email: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});
export type BroadcastInput = z.infer<typeof broadcastSchema>;

// company id → user ids who'll get it (active companies, unblocked logins, not exited)
async function recipients(input: BroadcastInput) {
  const rows = await db
    .select({ companyId: companyMembers.company_id, userId: companyMembers.user_id })
    .from(companyMembers)
    .innerJoin(companies, eq(companies.id, companyMembers.company_id))
    .innerJoin(users, eq(users.id, companyMembers.user_id))
    .innerJoin(employees, eq(employees.id, companyMembers.employee_id))
    .innerJoin(roles, eq(roles.id, employees.role_id))
    .where(
      and(
        eq(companies.status, "active"),
        eq(users.is_blocked, false),
        ne(employees.status, "exited"),
        input.companyIds.length ? inArray(companyMembers.company_id, input.companyIds) : undefined,
        input.audience === "admins" ? eq(roles.key, "admin") : undefined,
      ),
    );
  const byCompany = new Map<number, number[]>();
  for (const r of rows) byCompany.set(r.companyId, [...(byCompany.get(r.companyId) ?? []), r.userId]);
  return byCompany;
}

export async function sendBroadcast(actor: Express.AuthUser, input: BroadcastInput) {
  const byCompany = await recipients(input);
  const people = [...byCompany.values()].reduce((n, ids) => n + ids.length, 0);
  const summary = { companies: byCompany.size, people };
  if (input.dryRun) return { ...summary, sent: false };
  if (!people) throw new BadRequestError("Nobody matches — pick other companies or the audience");
  if (input.email && people > MAX_EMAILS) throw new BadRequestError(`That's ${people} emails — send in-app only, or pick fewer companies (max ${MAX_EMAILS})`);

  for (const [companyId, userIds] of byCompany) {
    await notify({
      companyId,
      to: userIds.map((userId) => ({ userId })),
      type: "platform.broadcast",
      title: input.title,
      body: input.message,
      link: "/",
      actorId: actor.id,
      email: input.email ? (r) => ({ template: "notification", props: { name: r.name, title: input.title, body: input.message, link: "/" } }) : undefined,
    });
  }
  audit(actor, {
    action: "platform.broadcast",
    summary: `Sent "${input.title}" to ${input.audience === "admins" ? "admins" : "everyone"} in ${summary.companies} compan${summary.companies === 1 ? "y" : "ies"} (${people} people${input.email ? ", with email" : ""})`,
    meta: { ...summary, audience: input.audience, email: input.email, companyIds: input.companyIds },
  });
  return { ...summary, sent: true };
}

// Earlier broadcasts (from the audit log)
export async function broadcastHistory() {
  return db
    .select({ id: auditLogs.id, summary: auditLogs.summary, actor_email: auditLogs.actor_email, created_at: auditLogs.created_at })
    .from(auditLogs)
    .where(eq(auditLogs.action, "platform.broadcast"))
    .orderBy(sql`${auditLogs.id} desc`)
    .limit(20);
}

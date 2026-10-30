// notify(): saves a bell notification per recipient and optionally emails them
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../../config/db.js";
import { companyMembers, employees, notifications, roles, users } from "../../db/schema.js";
import { sendTemplate } from "../mail/mail.service.js";
import type { TemplateName } from "../mail/templates.js";

export interface Recipient {
  userId?: number | null;
  employeeId?: number | null;
}

export interface ResolvedRecipient {
  userId: number | null; // null = no login (email only)
  employeeId: number | null;
  name: string;
  email: string | null;
}

export interface NotifyInput {
  companyId: number | null;
  to: Recipient[];
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  entity?: [type: string, id: number];
  actorId?: number | null; // the person who did it — never notified about their own action
  data?: Record<string, unknown>;
  // Also email each recipient (return null to skip one)
  email?: (r: ResolvedRecipient) => { template: TemplateName; props: unknown } | null;
}

// Employee / user → their login + email in this company.
async function resolve(companyId: number | null, to: Recipient[]): Promise<ResolvedRecipient[]> {
  const employeeIds = [...new Set(to.map((r) => r.employeeId).filter((x): x is number => Boolean(x)))];
  const userIds = [...new Set(to.map((r) => r.userId).filter((x): x is number => Boolean(x)))];
  const out = new Map<string, ResolvedRecipient>();

  if (employeeIds.length) {
    const rows = await db
      .select({ employeeId: employees.id, name: employees.name, email: employees.email, status: employees.status, userId: users.id, userEmail: users.email, blocked: users.is_blocked })
      .from(employees)
      .leftJoin(companyMembers, and(eq(companyMembers.employee_id, employees.id), eq(companyMembers.company_id, employees.company_id)))
      .leftJoin(users, eq(users.id, companyMembers.user_id))
      .where(and(inArray(employees.id, employeeIds), companyId ? eq(employees.company_id, companyId) : undefined));
    for (const r of rows) {
      if (r.status === "exited") continue;
      const userId = r.userId && !r.blocked ? r.userId : null;
      out.set(userId ? `u${userId}` : `e${r.employeeId}`, { userId, employeeId: r.employeeId, name: r.name, email: r.email || r.userEmail || null });
    }
  }
  if (userIds.length) {
    const rows = await db.select({ id: users.id, name: users.name, email: users.email, blocked: users.is_blocked }).from(users).where(inArray(users.id, userIds));
    for (const r of rows) if (!r.blocked && !out.has(`u${r.id}`)) out.set(`u${r.id}`, { userId: r.id, employeeId: null, name: r.name, email: r.email });
  }
  return [...out.values()];
}

export async function notify(input: NotifyInput) {
  try {
    const people = (await resolve(input.companyId, input.to)).filter((r) => !(input.actorId && r.userId === input.actorId));
    const withLogin = people.filter((r) => r.userId);
    if (withLogin.length) {
      await db.insert(notifications).values(
        withLogin.map((r) => ({
          company_id: input.companyId,
          user_id: r.userId!,
          type: input.type,
          title: input.title.slice(0, 200),
          body: input.body ?? null,
          link: input.link ?? null,
          entity_type: input.entity?.[0] ?? null,
          entity_id: input.entity?.[1] ?? null,
          actor_id: input.actorId ?? null,
          data: input.data ?? null,
        })),
      );
    }
    if (input.email) {
      for (const r of people) {
        const mail = r.email ? input.email(r) : null;
        if (mail) void sendTemplate(r.email, mail.template, mail.props as never);
      }
    }
  } catch (err) {
    console.error(`Notification "${input.type}" failed:`, (err as Error).message);
  }
}

// HR for a company: logins whose employee has the Admin or HR role (they step in for leave / corrections of people without a manager)
export async function hrRecipients(companyId: number): Promise<Recipient[]> {
  const rows = await db
    .select({ userId: companyMembers.user_id })
    .from(companyMembers)
    .innerJoin(employees, eq(employees.id, companyMembers.employee_id))
    .innerJoin(roles, eq(roles.id, employees.role_id))
    .where(and(eq(companyMembers.company_id, companyId), inArray(roles.key, ["admin", "hr"]), ne(employees.status, "exited")));
  return rows.map((r) => ({ userId: r.userId }));
}

// Everyone in the company with a login (announcements)
export async function companyRecipients(companyId: number): Promise<Recipient[]> {
  const rows = await db.select({ userId: companyMembers.user_id }).from(companyMembers).where(eq(companyMembers.company_id, companyId));
  return rows.map((r) => ({ userId: r.userId }));
}

// Admins of a company (its owners) — for messages from the Super Admin
export async function companyAdmins(companyId: number): Promise<Recipient[]> {
  const rows = await db
    .select({ userId: companyMembers.user_id })
    .from(companyMembers)
    .innerJoin(employees, eq(employees.id, companyMembers.employee_id))
    .innerJoin(roles, eq(roles.id, employees.role_id))
    .where(and(eq(companyMembers.company_id, companyId), eq(roles.key, "admin")));
  return rows.map((r) => ({ userId: r.userId }));
}

// Super Admin dashboard: platform-wide numbers at a glance.
import { desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { auditLogs, companies, companyMembers, employees, subscriptions, userSessions } from "../../db/schema.js";

const MONTHS = 6;

export async function platformOverview() {
  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const firstMonth = new Date();
  firstMonth.setUTCDate(1);
  firstMonth.setUTCHours(0, 0, 0, 0);
  firstMonth.setUTCMonth(firstMonth.getUTCMonth() - (MONTHS - 1));

  const [companyRows, [emp], [members], [active], subs, perMonth, toReview, recent] = await Promise.all([
    db.select({ status: companies.status, verification: companies.verification_status }).from(companies),
    db.select({ n: sql<number>`count(*)::int` }).from(employees),
    db.select({ n: sql<number>`count(distinct ${companyMembers.user_id})::int` }).from(companyMembers),
    db.select({ n: sql<number>`count(distinct ${userSessions.user_id})::int` }).from(userSessions).where(gt(userSessions.last_activity_at, since30)),
    db
      .select({ status: subscriptions.status, quantity: subscriptions.quantity, price: subscriptions.price_per_employee })
      .from(subscriptions),
    db
      .select({ month: sql<string>`to_char(date_trunc('month', ${companies.created_at}), 'YYYY-MM')`, n: sql<number>`count(*)::int` })
      .from(companies)
      .where(gt(companies.created_at, firstMonth))
      .groupBy(sql`1`),
    db
      .select({ id: companies.id, name: companies.name, verification_status: companies.verification_status, created_at: companies.created_at })
      .from(companies)
      .where(inArray(companies.verification_status, ["unverified", "pending"]))
      .orderBy(desc(companies.created_at))
      .limit(5),
    db
      .select({ id: auditLogs.id, action: auditLogs.action, summary: auditLogs.summary, actor_email: auditLogs.actor_email, created_at: auditLogs.created_at })
      .from(auditLogs)
      .orderBy(desc(auditLogs.id))
      .limit(8),
  ]);

  // Every one of the last 6 months, including the empty ones
  const counts = new Map(perMonth.map((r) => [r.month, r.n]));
  const growth = Array.from({ length: MONTHS }, (_, i) => {
    const d = new Date(firstMonth);
    d.setUTCMonth(d.getUTCMonth() + i);
    const key = d.toISOString().slice(0, 7);
    return { month: key, companies: counts.get(key) ?? 0 };
  });

  const paying = subs.filter((s) => s.status === "active");
  return {
    companies: {
      total: companyRows.length,
      active: companyRows.filter((c) => c.status === "active").length,
      suspended: companyRows.filter((c) => c.status === "suspended").length,
      verified: companyRows.filter((c) => c.verification === "verified").length,
      toReview: companyRows.filter((c) => c.verification === "unverified" || c.verification === "pending").length,
    },
    employees: emp.n,
    logins: members.n,
    activeUsers30d: active.n,
    subscriptions: {
      trial: subs.filter((s) => s.status === "trial").length,
      active: paying.length,
      pastDue: subs.filter((s) => s.status === "past_due").length,
      cancelled: subs.filter((s) => s.status === "cancelled").length,
      // Monthly revenue from paying companies: seats × price per employee
      mrr: Math.round(paying.reduce((sum, s) => sum + s.quantity * Number(s.price), 0) * 100) / 100,
    },
    growth,
    toReview,
    recent,
  };
}

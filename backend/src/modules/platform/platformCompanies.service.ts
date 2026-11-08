// Super Admin: every company on the platform — who owns it, how big it is, its trial / subscription, and its verification and account status.
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { companies, companyMembers, subscriptions, users } from "../../db/schema.js";
import { localDate } from "../../utils/workday.js";
import { requestOtp } from "../auth/passwordReset.service.js";
import { forgetCompanyStatus } from "../../utils/companyStatus.js";
import { BadRequestError, NotFoundError } from "../../utils/httpErrors.js";
import type { CompanyStatusInput, SubscriptionInput, VerificationInput } from "./platformCompanies.schema.js";
import { audit } from "../../utils/audit.js";
import { companyModuleStates } from "./platformModules.service.js";
import { companyAdmins, notify } from "../notifications/notify.js";

// The company's admins hear about the Super Admin's decisions (bell + email)
async function notifyCompanyAdmins(companyId: number, companyName: string, actorId: number, type: string, headline: string, text: string, note: string | null) {
  await notify({
    companyId,
    to: await companyAdmins(companyId),
    type,
    title: headline,
    body: note ? `${text} Note: ${note}` : text,
    link: "/",
    actorId,
    email: (r) => ({ template: "companyReview", props: { name: r.name, companyName, headline, message: text, note } }),
  });
}

// Owners = logins whose employee record in the company has the Admin role
const owners = sql<{ name: string; email: string }[]>`coalesce((
  select json_agg(json_build_object('name', u.name, 'email', u.email) order by u.created_at)
  from company_members m
  join users u on u.id = m.user_id
  join employees e on e.id = m.employee_id
  join roles r on r.id = e.role_id
  where m.company_id = ${companies.id} and r.key = 'admin'
), '[]'::json)`;
const employeeCount = sql<number>`(select count(*)::int from employees e where e.company_id = ${companies.id})`;
const userCount = sql<number>`(select count(*)::int from company_members m where m.company_id = ${companies.id})`;
// Health: people who used the app lately, last time anyone did, and today's check-ins
const activeUsers7d = sql<number>`(select count(distinct s.user_id)::int from user_sessions s join company_members m on m.user_id = s.user_id
  where m.company_id = ${companies.id} and s.last_activity_at > now() - interval '7 days')`;
const lastActiveAt = sql<string | null>`(select max(s.last_activity_at) from user_sessions s join company_members m on m.user_id = s.user_id where m.company_id = ${companies.id})`;
const checkinsToday = (today: string) => sql<number>`(select count(*)::int from attendance a where a.company_id = ${companies.id} and a.date = ${today} and a.punch_in is not null)`;

const summaryColumns = {
  id: companies.id,
  name: companies.name,
  legal_name: companies.legal_name,
  logo_url: companies.logo_url,
  industry: companies.industry,
  business_type: companies.business_type,
  employee_range: companies.employee_range,
  city: companies.city,
  state: companies.state,
  country: companies.country,
  created_at: companies.created_at,
  verification_status: companies.verification_status,
  status: companies.status,
  employee_count: employeeCount,
  user_count: userCount,
  owners,
  subscription_status: subscriptions.status,
  trial_ends_at: subscriptions.trial_ends_at,
  current_period_end: subscriptions.current_period_end,
  price_per_employee: subscriptions.price_per_employee,
  seats: subscriptions.quantity,
  active_users_7d: activeUsers7d,
  last_active_at: lastActiveAt,
};

const DAY = 86400000;

export async function listPlatformCompanies() {
  const rows = await db
    .select({ ...summaryColumns, checkins_today: checkinsToday(localDate()) })
    .from(companies)
    .leftJoin(subscriptions, eq(subscriptions.company_id, companies.id))
    .orderBy(desc(companies.created_at));
  const stats = {
    total: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    suspended: rows.filter((r) => r.status === "suspended").length,
    toReview: rows.filter((r) => r.verification_status === "unverified" || r.verification_status === "pending").length,
    employees: rows.reduce((sum, r) => sum + r.employee_count, 0),
    trial: rows.filter((r) => r.subscription_status === "trial").length,
    trialEnding: rows.filter((r) => r.subscription_status === "trial" && r.trial_ends_at && new Date(r.trial_ends_at).getTime() - Date.now() < 7 * DAY).length,
    paid: rows.filter((r) => r.subscription_status === "active").length,
    pastDue: rows.filter((r) => r.subscription_status === "past_due").length,
    // Nobody logged in for 14 days
    inactive: rows.filter((r) => !r.last_active_at || Date.now() - new Date(r.last_active_at).getTime() > 14 * DAY).length,
  };
  return { companies: rows, stats };
}

// Everything about one company, tax IDs included (Super Admin only)
export async function getPlatformCompany(id: number) {
  const [row] = await db
    .select({
      company: companies,
      employee_count: employeeCount,
      user_count: userCount,
      owners,
      subscription_status: subscriptions.status,
      trial_ends_at: subscriptions.trial_ends_at,
      current_period_end: subscriptions.current_period_end,
      price_per_employee: subscriptions.price_per_employee,
      seats: subscriptions.quantity,
      active_users_7d: activeUsers7d,
      last_active_at: lastActiveAt,
      checkins_today: checkinsToday(localDate()),
    })
    .from(companies)
    .leftJoin(subscriptions, eq(subscriptions.company_id, companies.id))
    .where(eq(companies.id, id));
  if (!row) throw new NotFoundError("Company not found");
  const { company, ...rest } = row;
  // Usage in the last 30 days
  const [usage] = await db.execute<{ logins: number; checkins: number; leaves: number; payslips: number }>(sql`select
    (select count(*)::int from user_sessions s join company_members m on m.user_id = s.user_id where m.company_id = ${id} and s.created_at > now() - interval '30 days') as logins,
    (select count(*)::int from attendance a where a.company_id = ${id} and a.punch_in > now() - interval '30 days') as checkins,
    (select count(*)::int from leave_requests l where l.company_id = ${id} and l.created_at > now() - interval '30 days') as leaves,
    (select count(*)::int from payslips p where p.company_id = ${id} and p.created_at > now() - interval '30 days') as payslips`).then((r) => r.rows);
  const admins = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(companyMembers)
    .innerJoin(users, eq(users.id, companyMembers.user_id))
    .where(and(eq(companyMembers.company_id, id), sql`exists (select 1 from employees e join roles r on r.id = e.role_id where e.id = ${companyMembers.employee_id} and r.key = 'admin')`));
  return { company: { ...company, ...rest }, modules: await companyModuleStates(id), usage, admins };
}

// Trial end date and price per employee for one company (custom deals)
export async function setSubscription(actor: Express.AuthUser, id: number, input: SubscriptionInput) {
  const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, id));
  if (!company) throw new NotFoundError("Company not found");
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.company_id, id));
  if (!sub) throw new NotFoundError("This company has no subscription record");
  const set: Partial<typeof subscriptions.$inferInsert> = { updated_at: new Date() };
  const changes: string[] = [];
  if (input.trialEndsOn !== undefined) {
    if (sub.status !== "trial") throw new BadRequestError("Only a company on trial can get a new trial end date");
    set.trial_ends_at = new Date(`${input.trialEndsOn}T23:59:59+05:30`);
    changes.push(`trial ends ${input.trialEndsOn}`);
  }
  if (input.pricePerEmployee !== undefined) {
    set.price_per_employee = String(input.pricePerEmployee);
    changes.push(`price ₹${input.pricePerEmployee}/employee`);
  }
  await db.update(subscriptions).set(set).where(eq(subscriptions.company_id, id));
  audit(actor, { action: "company.subscription", companyId: id, target: ["company", id], summary: `${company.name}: ${changes.join(", ")}` });
  return getPlatformCompany(id);
}

export async function setAdminNotes(actor: Express.AuthUser, id: number, notes: string | null) {
  const [row] = await db.update(companies).set({ admin_notes: notes }).where(eq(companies.id, id)).returning({ name: companies.name });
  if (!row) throw new NotFoundError("Company not found");
  audit(actor, { action: "company.notes", companyId: id, target: ["company", id], summary: `Updated notes on ${row.name}` });
  return getPlatformCompany(id);
}

// Support: email a password-reset code to one of the company's logins
export async function sendPasswordReset(actor: Express.AuthUser, id: number, userId: number) {
  const [u] = await db
    .select({ email: users.email, name: users.name })
    .from(companyMembers)
    .innerJoin(users, eq(users.id, companyMembers.user_id))
    .where(and(eq(companyMembers.company_id, id), eq(users.id, userId)));
  if (!u) throw new NotFoundError("That login isn't part of this company");
  await requestOtp(u.email);
  audit(actor, { action: "support.password_reset", companyId: id, target: ["user", userId], summary: `Sent a password reset code to ${u.name} (${u.email})` });
  return { sentTo: u.email };
}

export async function setVerification(actor: Express.AuthUser, id: number, { status, notes }: VerificationInput) {
  const reviewerId = actor.id;
  const [row] = await db
    .update(companies)
    .set({
      verification_status: status,
      verification_notes: notes ?? null,
      verified_at: status === "verified" ? new Date() : null,
      reviewed_by: reviewerId,
    })
    .where(eq(companies.id, id))
    .returning({ id: companies.id, name: companies.name });
  if (!row) throw new NotFoundError("Company not found");
  const verb = { verified: "Verified", rejected: "Rejected", pending: "Marked in review", unverified: "Marked unverified" }[status];
  audit(actor, { action: `company.${status === "pending" ? "in_review" : status}`, companyId: id, target: ["company", id], summary: `${verb} ${row.name}${notes ? ` — ${notes}` : ""}` });
  const message = {
    verified: { headline: "Your company is verified", text: `Workkind has verified ${row.name}'s details.` },
    rejected: { headline: "Your company details need changes", text: `Workkind couldn't verify ${row.name}'s details. Please check the note and update them.` },
    pending: { headline: "Your company is being reviewed", text: `Workkind is reviewing ${row.name}'s details.` },
    unverified: null,
  }[status];
  if (message) void notifyCompanyAdmins(id, row.name, actor.id, `company.${status}`, message.headline, message.text, notes ?? null);
  return getPlatformCompany(id);
}

export async function setCompanyStatus(actor: Express.AuthUser, id: number, { status, reason }: CompanyStatusInput) {
  const reviewerId = actor.id;
  const [row] = await db
    .update(companies)
    .set({ status, status_reason: status === "suspended" ? (reason ?? null) : null, status_changed_at: new Date(), reviewed_by: reviewerId })
    .where(eq(companies.id, id))
    .returning({ id: companies.id, name: companies.name });
  if (!row) throw new NotFoundError("Company not found");
  audit(actor, {
    action: status === "suspended" ? "company.suspended" : "company.reactivated",
    companyId: id,
    target: ["company", id],
    summary: status === "suspended" ? `Suspended ${row.name} — ${reason}` : `Reactivated ${row.name}`,
  });
  forgetCompanyStatus(id); // takes effect on the company's very next request
  void notifyCompanyAdmins(
    id,
    row.name,
    actor.id,
    `company.${status}`,
    status === "suspended" ? "Your company's account is suspended" : "Your company's account is active again",
    status === "suspended" ? `${row.name}'s Workkind account has been suspended, so nobody in it can use the app for now.` : `${row.name}'s Workkind account has been reactivated.`,
    status === "suspended" ? (reason ?? null) : null,
  );
  return getPlatformCompany(id);
}

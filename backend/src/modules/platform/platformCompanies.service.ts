// Super Admin: every company on the platform — who owns it, how big it is, its trial / subscription, and its verification and account status.
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { companies, subscriptions } from "../../db/schema.js";
import { forgetCompanyStatus } from "../../utils/companyStatus.js";
import { NotFoundError } from "../../utils/httpErrors.js";
import type { CompanyStatusInput, VerificationInput } from "./platformCompanies.schema.js";
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
};

export async function listPlatformCompanies() {
  const rows = await db
    .select(summaryColumns)
    .from(companies)
    .leftJoin(subscriptions, eq(subscriptions.company_id, companies.id))
    .orderBy(desc(companies.created_at));
  const stats = {
    total: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    suspended: rows.filter((r) => r.status === "suspended").length,
    toReview: rows.filter((r) => r.verification_status === "unverified" || r.verification_status === "pending").length,
    employees: rows.reduce((sum, r) => sum + r.employee_count, 0),
  };
  return { companies: rows, stats };
}

// Everything about one company, tax IDs included (Super Admin only)
export async function getPlatformCompany(id: number) {
  const [row] = await db
    .select({ company: companies, employee_count: employeeCount, user_count: userCount, owners, subscription_status: subscriptions.status, trial_ends_at: subscriptions.trial_ends_at })
    .from(companies)
    .leftJoin(subscriptions, eq(subscriptions.company_id, companies.id))
    .where(eq(companies.id, id));
  if (!row) throw new NotFoundError("Company not found");
  const { company, ...rest } = row;
  return { company: { ...company, ...rest }, modules: await companyModuleStates(id) };
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

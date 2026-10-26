// Companies a superadmin owns. A new superadmin has none until they create one;
// creating a company sets it up fully (trial, the owner as its Admin employee
// record) and makes it their current company. They can own several and switch.
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { companies, companyMembers, employees, users } from "../../db/schema.js";
import { NotFoundError } from "../../utils/httpErrors.js";
import { localDate } from "../../utils/workday.js";
import { createTrialSubscription, syncSubscriptionQuantity } from "../billing/billing.service.js";
import { SUPERADMIN_ROLE } from "../../config/permissions.js";
import { designationByKey } from "../pages/access.service.js";
import type { CreateCompanyInput } from "./companies.schema.js";

// Optional form text: blank → null
const clean = (v: string | null | undefined) => v?.trim() || null;

interface Owner {
  id: number;
  name: string;
  email: string;
  role: string;
}

export async function findCompany(id: number) {
  const [company] = await db.select().from(companies).where(eq(companies.id, id));
  return company;
}

// Creates the company and everything it needs, all or nothing. Returns its id.
export async function createCompanyForUser(owner: Owner, input: CreateCompanyInput) {
  const companyId = await db.transaction(async (tx) => {
    const [company] = await tx
      .insert(companies)
      .values({
        name: input.companyName,
        industry: clean(input.industry),
        logo_url: input.logoUrl ?? null,
        employee_range: input.employeeRange ?? null,
        website: clean(input.website),
        email: clean(input.email),
        phone: clean(input.phone),
        address: clean(input.address),
        city: clean(input.city),
        state: clean(input.state),
        country: clean(input.country),
        postal_code: clean(input.postalCode),
      })
      .returning();

    // Free trial — billing starts once they subscribe from the Billing page
    await createTrialSubscription(company.id, env.TRIAL_DAYS, tx);

    // The owner is the company's Admin (the platform Super Admin keeps Super Admin)
    const designation = await designationByKey(owner.role === SUPERADMIN_ROLE ? "superadmin" : "admin");
    if (!designation) throw new Error("Designations are missing — run the database migrations");

    // The owner is an employee of their company too (attendance, leave, tickets…)
    const [employee] = await tx
      .insert(employees)
      .values({ company_id: company.id, name: owner.name, email: owner.email, designation_id: designation.id, join_date: localDate() })
      .returning({ id: employees.id });

    await tx.insert(companyMembers).values({ user_id: owner.id, company_id: company.id, employee_id: employee.id });
    await tx.update(users).set({ company_id: company.id, employee_id: employee.id }).where(eq(users.id, owner.id));
    return company.id;
  });

  await syncSubscriptionQuantity(companyId); // headcount is now 1
  return companyId;
}

// Every company this login can open, current one marked
export async function listMyCompanies(userId: number, currentCompanyId: number | null) {
  const rows = await db
    .select({ id: companies.id, name: companies.name, industry: companies.industry, logo_url: companies.logo_url })
    .from(companyMembers)
    .innerJoin(companies, eq(companies.id, companyMembers.company_id))
    .where(eq(companyMembers.user_id, userId))
    .orderBy(asc(sql`lower(${companies.name})`));
  return { companies: rows.map((c) => ({ ...c, current: c.id === currentCompanyId })) };
}

// Makes another of the user's companies the current one (and their employee record in it)
export async function switchCompany(userId: number, companyId: number) {
  const [membership] = await db
    .select()
    .from(companyMembers)
    .where(and(eq(companyMembers.user_id, userId), eq(companyMembers.company_id, companyId)));
  if (!membership) throw new NotFoundError("Company not found");
  await db.update(users).set({ company_id: companyId, employee_id: membership.employee_id }).where(eq(users.id, userId));
}

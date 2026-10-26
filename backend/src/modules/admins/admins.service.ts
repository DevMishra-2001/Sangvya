// Admin logins (company owners), managed by the Super Admin. There's no public
// signup: an Admin gets their login from here, then registers their company on
// first login (proxy.ts sends a login without a company to /onboarding).
import bcrypt from "bcryptjs";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../../config/db.js";
import { SUPERADMIN_ROLE } from "../../config/permissions.js";
import { companies, companyMembers, designations, employees, users } from "../../db/schema.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import { findUserByEmail, insertUser } from "../users/users.service.js";
import type { CreateAdminInput } from "./admins.schema.js";

// Logins that are Admin of a company, or that have no company yet (just created)
export async function listAdmins() {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      created_at: users.created_at,
      company_id: companies.id,
      company_name: companies.name,
      designation: designations.key,
    })
    .from(users)
    .leftJoin(companyMembers, eq(companyMembers.user_id, users.id))
    .leftJoin(companies, eq(companies.id, companyMembers.company_id))
    .leftJoin(employees, eq(employees.id, companyMembers.employee_id))
    .leftJoin(designations, eq(designations.id, employees.designation_id))
    .where(ne(users.role, SUPERADMIN_ROLE))
    .orderBy(asc(users.created_at));

  const byUser = new Map<number, { id: number; name: string; email: string; created_at: Date | null; companies: { id: number; name: string }[]; isAdmin: boolean }>();
  for (const r of rows) {
    const entry = byUser.get(r.id) ?? { id: r.id, name: r.name, email: r.email, created_at: r.created_at, companies: [], isAdmin: false };
    if (r.company_id && r.designation === "admin") {
      entry.companies.push({ id: r.company_id, name: r.company_name! });
      entry.isAdmin = true;
    }
    if (!r.company_id) entry.isAdmin = true; // no company yet = an Admin who hasn't set it up
    byUser.set(r.id, entry);
  }
  return {
    admins: [...byUser.values()]
      .filter((u) => u.isAdmin)
      .map(({ isAdmin: _a, ...u }) => ({ ...u, status: u.companies.length ? "active" : "pending" })),
  };
}

export async function createAdmin(input: CreateAdminInput) {
  if (await findUserByEmail(input.email)) throw new ConflictError("An account with this email already exists");
  const user = await insertUser({
    companyId: null,
    name: input.name,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 10),
  });
  return { admin: { id: user.id, name: user.name, email: user.email, created_at: user.created_at, companies: [], status: "pending" } };
}

// Only while they haven't set up a company — after that, remove them from inside the company
export async function deleteAdmin(id: number) {
  const [user] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, id));
  if (!user || user.role === SUPERADMIN_ROLE) throw new NotFoundError("Admin not found");
  const [member] = await db.select({ id: companyMembers.id }).from(companyMembers).where(eq(companyMembers.user_id, id)).limit(1);
  if (member) throw new BadRequestError("This admin already has a company — they can't be removed from here");
  await db.delete(users).where(and(eq(users.id, id), inArray(users.role, ["member"])));
}

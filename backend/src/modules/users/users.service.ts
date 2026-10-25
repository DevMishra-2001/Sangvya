import bcrypt from "bcryptjs";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { ROLE_LEVEL, ROLES, type Role } from "../../config/permissions.js";
import { companyMembers, employees, users } from "../../db/schema.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { findEmployeeById } from "../employees/employees.service.js";
import type { CreateUserInput, UpdateUserInput } from "./users.schema.js";

// Everything about a user except the password hash
const publicColumns = {
  id: users.id,
  company_id: users.company_id,
  employee_id: users.employee_id,
  name: users.name,
  email: users.email,
  role: users.role,
  font_size: users.font_size,
  created_at: users.created_at,
};

// ---- Lookups shared with auth / settings ----

export async function findUserById(id: number) {
  const [user] = await db.select(publicColumns).from(users).where(eq(users.id, id));
  return user;
}

// Full row incl. password_hash — only for login / duplicate checks
export async function findUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

// Case-insensitive email lookup (forgot password: users type their email freely)
export async function findUserByEmailInsensitive(email: string) {
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`);
  return user;
}

// Includes password_hash — only for comparing against a new password
export async function findUserWithPassword(id: number) {
  const [user] = await db.select({ id: users.id, password_hash: users.password_hash }).from(users).where(eq(users.id, id));
  return user;
}

export async function insertUser(values: {
  companyId: number | null;
  name: string;
  email: string;
  passwordHash: string;
  role?: Role;
  employeeId?: number | null;
}) {
  const [user] = await db
    .insert(users)
    .values({
      company_id: values.companyId,
      name: values.name,
      email: values.email,
      password_hash: values.passwordHash,
      role: values.role ?? "employee",
      employee_id: values.employeeId ?? null,
    })
    .returning(publicColumns);
  return user;
}

export async function setUserPassword(id: number, passwordHash: string) {
  await db.update(users).set({ password_hash: passwordHash }).where(eq(users.id, id));
}

export async function setUserFontSize(id: number, fontSize: number) {
  const [row] = await db.update(users).set({ font_size: fontSize }).where(eq(users.id, id)).returning({ font_size: users.font_size });
  return row?.font_size;
}

// ---- User management (company-scoped) ----

// A user may only manage accounts strictly below their own level
// (superadmin is the exception and can manage anyone, incl. other superadmins).
function canManageRole(actorRole: Role, targetRole: string) {
  if (actorRole === "superadmin") return true;
  return ROLE_LEVEL[targetRole as Role] < ROLE_LEVEL[actorRole];
}

// A user who is a member of this company, with their employee link *in this company*
async function findUserInCompany(companyId: number, id: number) {
  const [user] = await db
    .select({ ...publicColumns, company_id: users.company_id, employee_id: companyMembers.employee_id })
    .from(companyMembers)
    .innerJoin(users, eq(users.id, companyMembers.user_id))
    .where(and(eq(companyMembers.company_id, companyId), eq(companyMembers.user_id, id)));
  return user;
}

// An employee link must point at this company's employee and not one that
// already has a different login.
async function assertEmployeeLinkable(companyId: number, employeeId: number | null | undefined, userId: number | null = null) {
  if (!employeeId) return;
  if (!(await findEmployeeById(companyId, employeeId))) throw new BadRequestError("Employee not found");
  const [linked] = await db
    .select({ userId: companyMembers.user_id })
    .from(companyMembers)
    .where(and(eq(companyMembers.company_id, companyId), eq(companyMembers.employee_id, employeeId)));
  if (linked && linked.userId !== userId) throw new BadRequestError("This employee already has a login");
}

export async function listUsers(companyId: number) {
  const rows = await db
    .select({
      id: users.id,
      company_id: companyMembers.company_id,
      employee_id: companyMembers.employee_id,
      name: users.name,
      email: users.email,
      role: users.role,
      created_at: users.created_at,
      employee_name: employees.name,
    })
    .from(companyMembers)
    .innerJoin(users, eq(users.id, companyMembers.user_id))
    .leftJoin(employees, eq(employees.id, companyMembers.employee_id))
    .where(eq(companyMembers.company_id, companyId))
    .orderBy(asc(users.created_at));
  return { users: rows, roles: ROLES };
}

export async function createUser(companyId: number, actor: Express.AuthUser, input: CreateUserInput) {
  if (!canManageRole(actor.role, input.role)) throw new ForbiddenError(`You can't create a ${input.role} account`);
  if (await findUserByEmail(input.email)) throw new ConflictError("An account with this email already exists");
  await assertEmployeeLinkable(companyId, input.employeeId);

  const passwordHash = await bcrypt.hash(input.password, 10);
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ company_id: companyId, name: input.name, email: input.email, password_hash: passwordHash, role: input.role, employee_id: input.employeeId ?? null })
      .returning(publicColumns);
    await tx.insert(companyMembers).values({ user_id: user.id, company_id: companyId, employee_id: input.employeeId ?? null });
    return user;
  });
}

export async function updateUser(companyId: number, actor: Express.AuthUser, id: number, input: UpdateUserInput) {
  const existing = await findUserInCompany(companyId, id);
  if (!existing) throw new NotFoundError("User not found");

  const name = input.name ?? existing.name;
  const role = input.role ?? existing.role;
  // undefined = keep the current link; null = unlink
  const employeeId = input.employeeId !== undefined ? input.employeeId : existing.employee_id;

  const isSelf = existing.id === actor.id;
  if (isSelf && role !== existing.role) throw new BadRequestError("You can't change your own role");
  // Editing yourself (name / employee link) is fine; otherwise the target must rank below you
  if (!isSelf && (!canManageRole(actor.role, existing.role) || !canManageRole(actor.role, role))) {
    throw new ForbiddenError("You don't have permission to change this account");
  }
  await assertEmployeeLinkable(companyId, employeeId, existing.id);

  await db.transaction(async (tx) => {
    await tx.update(users).set({ name, role }).where(eq(users.id, id));
    await tx
      .update(companyMembers)
      .set({ employee_id: employeeId })
      .where(and(eq(companyMembers.company_id, companyId), eq(companyMembers.user_id, id)));
    // If this is the company they're working in now, their current link changes too
    await tx
      .update(users)
      .set({ employee_id: employeeId })
      .where(and(eq(users.id, id), eq(users.company_id, companyId)));
  });
  return findUserInCompany(companyId, id);
}

// Removes the login from this company. If they still belong to another company
// (a superadmin who owns several), only this membership goes; otherwise the login is deleted.
export async function deleteUser(companyId: number, actor: Express.AuthUser, id: number) {
  if (id === actor.id) throw new BadRequestError("You can't delete your own account");

  const existing = await findUserInCompany(companyId, id);
  if (!existing) throw new NotFoundError("User not found");
  if (!canManageRole(actor.role, existing.role)) throw new ForbiddenError("You don't have permission to delete this account");

  const [other] = await db
    .select()
    .from(companyMembers)
    .where(and(eq(companyMembers.user_id, id), ne(companyMembers.company_id, companyId)))
    .limit(1);
  if (!other) {
    await db.delete(users).where(eq(users.id, id));
    return;
  }
  await db.transaction(async (tx) => {
    await tx.delete(companyMembers).where(and(eq(companyMembers.user_id, id), eq(companyMembers.company_id, companyId)));
    await tx
      .update(users)
      .set({ company_id: other.company_id, employee_id: other.employee_id })
      .where(and(eq(users.id, id), eq(users.company_id, companyId)));
  });
}

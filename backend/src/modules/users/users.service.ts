import bcrypt from "bcryptjs";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { SUPERADMIN_ROLE } from "../../config/permissions.js";
import { companyMembers, designations, employees, users } from "../../db/schema.js";
import { can } from "../../utils/can.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { revokeAllSessionsForUser } from "../auth/session.service.js";
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
  is_blocked: users.is_blocked,
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
  employeeId?: number | null;
}) {
  const [user] = await db
    .insert(users)
    .values({
      company_id: values.companyId,
      name: values.name,
      email: values.email,
      password_hash: values.passwordHash,
      role: "member",
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

// How senior a login is in this company: the Super Admin outranks everyone,
// otherwise it's the level of their employee's designation (0 = none)
async function levelOf(user: { role: string; employee_id: number | null }) {
  if (user.role === SUPERADMIN_ROLE) return 99;
  if (!user.employee_id) return 0;
  const [row] = await db
    .select({ level: designations.level })
    .from(employees)
    .innerJoin(designations, eq(designations.id, employees.designation_id))
    .where(eq(employees.id, user.employee_id));
  return row?.level ?? 0;
}

// You can manage logins at or below your own level (never the Super Admin's)
async function assertCanManage(actor: Express.AuthUser, target: { role: string; employee_id: number | null }) {
  if (actor.isSuperadmin) return;
  if (target.role === SUPERADMIN_ROLE || (await levelOf(target)) > actor.level) {
    throw new ForbiddenError("You don't have permission to change this account");
  }
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
      is_superadmin: sql<boolean>`${users.role} = ${SUPERADMIN_ROLE}`,
      created_at: users.created_at,
      employee_name: employees.name,
      designation: designations.name,
      designation_level: designations.level,
    })
    .from(companyMembers)
    .innerJoin(users, eq(users.id, companyMembers.user_id))
    .leftJoin(employees, eq(employees.id, companyMembers.employee_id))
    .leftJoin(designations, eq(designations.id, employees.designation_id))
    .where(eq(companyMembers.company_id, companyId))
    .orderBy(asc(users.created_at));
  return { users: rows };
}

export async function createUser(companyId: number, actor: Express.AuthUser, input: CreateUserInput) {
  if (await findUserByEmail(input.email)) throw new ConflictError("An account with this email already exists");
  await assertEmployeeLinkable(companyId, input.employeeId);
  await assertCanManage(actor, { role: "member", employee_id: input.employeeId });

  const passwordHash = await bcrypt.hash(input.password, 10);
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ company_id: companyId, name: input.name, email: input.email, password_hash: passwordHash, employee_id: input.employeeId })
      .returning(publicColumns);
    await tx.insert(companyMembers).values({ user_id: user.id, company_id: companyId, employee_id: input.employeeId ?? null });
    return user;
  });
}

export async function updateUser(companyId: number, actor: Express.AuthUser, id: number, input: UpdateUserInput) {
  const existing = await findUserInCompany(companyId, id);
  if (!existing) throw new NotFoundError("User not found");

  const name = input.name ?? existing.name;
  // undefined = keep the current link; null = unlink
  const employeeId = input.employeeId !== undefined ? input.employeeId : existing.employee_id;

  const isSelf = existing.id === actor.id;
  if (isSelf && employeeId !== existing.employee_id) throw new BadRequestError("You can't change your own employee link");
  // Editing yourself (name) is fine; otherwise the target — before and after — must not rank above you
  if (!isSelf) {
    await assertCanManage(actor, existing);
    await assertCanManage(actor, { role: existing.role, employee_id: employeeId });
  }
  await assertEmployeeLinkable(companyId, employeeId, existing.id);

  await db.transaction(async (tx) => {
    await tx.update(users).set({ name }).where(eq(users.id, id));
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
  await assertCanManage(actor, existing);

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

// ---- An employee's login, managed from the employee form ----

// The login linked to this employee in this company, if any
async function findLoginForEmployee(companyId: number, employeeId: number) {
  const [row] = await db
    .select({ id: users.id, role: users.role, employee_id: companyMembers.employee_id })
    .from(companyMembers)
    .innerJoin(users, eq(users.id, companyMembers.user_id))
    .where(and(eq(companyMembers.company_id, companyId), eq(companyMembers.employee_id, employeeId)));
  return row;
}

// Before creating an employee together with a login: fail early (so the
// employee isn't created) if the login can't be made
export async function assertCanCreateLogin(actor: Express.AuthUser, email: string | null | undefined) {
  if (!can(actor, "users.manage")) throw new ForbiddenError("You can't create logins");
  if (!email?.trim()) throw new BadRequestError("Add the employee's email — they log in with it");
  if (await findUserByEmail(email.trim())) throw new ConflictError("An account with this email already exists");
}

interface LoginChanges {
  password?: string; // creates the login, or sets a new password
  blocked?: boolean;
}

// Checks a login change without saving anything — run it before the employee
// is saved, so a refused change leaves everything as it was
export async function assertLoginChangeAllowed(companyId: number, actor: Express.AuthUser, employeeId: number | null, email: string | null | undefined, { password, blocked }: LoginChanges) {
  if (password === undefined && blocked === undefined) return;
  const existing = employeeId ? await findLoginForEmployee(companyId, employeeId) : undefined;
  if (!existing) {
    if (password) await assertCanCreateLogin(actor, email);
    return;
  }
  // Changing someone's login needs users.manage and a rank at or above theirs
  const isSelf = existing.id === actor.id;
  if (isSelf && blocked) throw new BadRequestError("You can't block your own login");
  if (isSelf) return;
  const current = await db.select({ is_blocked: users.is_blocked }).from(users).where(eq(users.id, existing.id));
  const changing = Boolean(password) || (blocked !== undefined && blocked !== current[0]?.is_blocked);
  if (!changing) return;
  if (!can(actor, "users.manage")) throw new ForbiddenError("You can't change logins");
  await assertCanManage(actor, existing);
}

export async function saveEmployeeLogin(
  companyId: number,
  actor: Express.AuthUser,
  employee: { id: number; name: string; email: string | null },
  changes: LoginChanges,
) {
  const { password, blocked } = changes;
  if (password === undefined && blocked === undefined) return;
  await assertLoginChangeAllowed(companyId, actor, employee.id, employee.email, changes);
  const existing = await findLoginForEmployee(companyId, employee.id);

  if (!existing) {
    if (!password) return; // no login and no password: nothing to block
    const user = await createUser(companyId, actor, { name: employee.name, email: employee.email!.trim(), password, employeeId: employee.id });
    if (blocked) await db.update(users).set({ is_blocked: true }).where(eq(users.id, user.id));
    return;
  }
  const isSelf = existing.id === actor.id;

  const update: Partial<typeof users.$inferInsert> = {};
  if (password) update.password_hash = await bcrypt.hash(password, 10);
  if (blocked !== undefined && !isSelf) update.is_blocked = blocked;
  if (!Object.keys(update).length) return;
  await db.update(users).set(update).where(eq(users.id, existing.id));

  // A new password or a block ends their open sessions (keeping mine if it's me)
  if (password || blocked) await revokeAllSessionsForUser(existing.id, isSelf ? actor.sessionId : null);
}

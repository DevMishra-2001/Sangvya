import { and, asc, count, eq, getTableColumns, sql } from "drizzle-orm";
import { db, type Database, type Transaction } from "../../config/db.js";
import { designations, employees } from "../../db/schema.js";
import { ConflictError, NotFoundError } from "../../utils/httpErrors.js";

type Executor = Database | Transaction;

// Every new company starts with these; they can add, rename or remove their own.
export const DEFAULT_DESIGNATIONS = [
  "Founder",
  "Director",
  "General Manager",
  "HR Manager",
  "HR Executive",
  "Engineering Manager",
  "Team Lead",
  "Senior Software Engineer",
  "Software Engineer",
  "QA Engineer",
  "Product Manager",
  "UI/UX Designer",
  "Accountant",
  "Sales Executive",
  "Operations Executive",
  "Intern",
];

// Inserts the default list for a new company
export async function seedDefaultDesignations(executor: Executor, companyId: number) {
  return executor
    .insert(designations)
    .values(DEFAULT_DESIGNATIONS.map((name) => ({ company_id: companyId, name })))
    .returning();
}

async function findByName(executor: Executor, companyId: number, name: string) {
  const [row] = await executor
    .select()
    .from(designations)
    .where(and(eq(designations.company_id, companyId), sql`lower(${designations.name}) = lower(${name})`));
  return row;
}

// The designation with this name (case-insensitive), created if the company doesn't have it yet
export async function findOrCreateDesignation(companyId: number, name: string, executor: Executor = db) {
  const trimmed = name.trim();
  const existing = await findByName(executor, companyId, trimmed);
  if (existing) return existing;
  const [created] = await executor.insert(designations).values({ company_id: companyId, name: trimmed }).returning();
  return created;
}

// Must belong to this company (an id from another company is "not found")
export async function assertDesignationInCompany(companyId: number, id: number) {
  const [row] = await db
    .select({ id: designations.id })
    .from(designations)
    .where(and(eq(designations.company_id, companyId), eq(designations.id, id)));
  if (!row) throw new NotFoundError("Designation not found");
}

// ---- Designations page ----

export async function listDesignations(companyId: number) {
  const rows = await db
    .select({ ...getTableColumns(designations), employee_count: count(employees.id) })
    .from(designations)
    .leftJoin(employees, eq(employees.designation_id, designations.id))
    .where(eq(designations.company_id, companyId))
    .groupBy(designations.id)
    .orderBy(asc(designations.name));
  return { designations: rows };
}

export async function createDesignation(companyId: number, name: string) {
  if (await findByName(db, companyId, name)) throw new ConflictError(`"${name}" already exists`);
  const [designation] = await db.insert(designations).values({ company_id: companyId, name }).returning();
  return { designation: { ...designation, employee_count: 0 } };
}

export async function renameDesignation(companyId: number, id: number, name: string) {
  const clash = await findByName(db, companyId, name);
  if (clash && clash.id !== id) throw new ConflictError(`"${name}" already exists`);
  const [designation] = await db
    .update(designations)
    .set({ name })
    .where(and(eq(designations.company_id, companyId), eq(designations.id, id)))
    .returning();
  if (!designation) throw new NotFoundError("Designation not found");
  return { designation };
}

// Employees who had it keep working — their designation just becomes empty
export async function deleteDesignation(companyId: number, id: number) {
  const [deleted] = await db
    .delete(designations)
    .where(and(eq(designations.company_id, companyId), eq(designations.id, id)))
    .returning({ id: designations.id });
  if (!deleted) throw new NotFoundError("Designation not found");
}

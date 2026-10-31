import { and, asc, count, desc, eq, getTableColumns, ne, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { branches, employees } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import type { BranchInput } from "./branches.schema.js";

const branchCols = getTableColumns(branches);

const columns = (i: BranchInput) => ({
  name: i.name,
  code: i.code ? i.code.toUpperCase() : null,
  address: i.address,
  city: i.city,
  state: i.state,
  country: i.country,
  postal_code: i.postalCode,
  phone: i.phone,
  email: i.email,
  latitude: i.latitude,
  longitude: i.longitude,
  radius_m: i.radiusM,
  geofence_enabled: i.geofenceEnabled,
  is_head_office: i.isHeadOffice,
  is_active: i.isActive,
});

// Head office first, then by name, with how many employees sit at each
export async function listBranches(companyId: number) {
  const rows = await db
    .select({ ...branchCols, employee_count: sql<number>`(${count(employees.id)})::int` })
    .from(branches)
    .leftJoin(employees, and(eq(employees.branch_id, branches.id), ne(employees.status, "exited")))
    .where(eq(branches.company_id, companyId))
    .groupBy(branches.id)
    .orderBy(desc(branches.is_head_office), asc(branches.name));
  return { branches: rows };
}

async function findBranch(companyId: number, id: number) {
  const [row] = await db.select().from(branches).where(and(eq(branches.company_id, companyId), eq(branches.id, id)));
  if (!row) throw new NotFoundError("Branch not found");
  return row;
}

async function assertNameFree(companyId: number, name: string, id: number | null) {
  const [clash] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.company_id, companyId), sql`lower(${branches.name}) = lower(${name})`));
  if (clash && clash.id !== id) throw new ConflictError(`A branch called "${name}" already exists`);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
// Only one head office per company
async function clearHeadOffice(tx: Tx, companyId: number, keepId: number) {
  await tx.update(branches).set({ is_head_office: false }).where(and(eq(branches.company_id, companyId), ne(branches.id, keepId)));
}

export async function createBranch(companyId: number, actor: Express.AuthUser, input: BranchInput) {
  await assertNameFree(companyId, input.name, null);
  const branch = await db.transaction(async (tx) => {
    const [row] = await tx.insert(branches).values({ company_id: companyId, ...columns(input) }).returning();
    if (row.is_head_office) await clearHeadOffice(tx, companyId, row.id);
    return row;
  });
  audit(actor, { companyId, action: "branch.created", target: ["branch", branch.id], summary: `Added the branch ${branch.name}` });
  return { branch };
}

export async function updateBranch(companyId: number, actor: Express.AuthUser, id: number, input: BranchInput) {
  await findBranch(companyId, id);
  await assertNameFree(companyId, input.name, id);
  const branch = await db.transaction(async (tx) => {
    const [row] = await tx.update(branches).set(columns(input)).where(eq(branches.id, id)).returning();
    if (row.is_head_office) await clearHeadOffice(tx, companyId, row.id);
    return row;
  });
  audit(actor, { companyId, action: "branch.updated", target: ["branch", id], summary: `Updated the branch ${branch.name}` });
  return { branch };
}

// Employees at the branch keep working; their branch is cleared
export async function deleteBranch(companyId: number, actor: Express.AuthUser, id: number) {
  const branch = await findBranch(companyId, id);
  await db.delete(branches).where(eq(branches.id, id));
  audit(actor, { companyId, action: "branch.removed", target: ["branch", id], summary: `Removed the branch ${branch.name}` });
}

// For the employee form: must be this company's and active (unless they already have it)
export async function assertBranchUsable(companyId: number, id: number, currentId: number | null = null) {
  const row = await findBranch(companyId, id);
  if (id !== currentId && !row.is_active) throw new BadRequestError(`"${row.name}" is inactive`);
}

// ---- Geofence ----

// Distance in metres between two points (haversine)
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const fmt = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

// Office check-in: inside the employee's branch radius (GPS accuracy up to 100 m is forgiven)
export async function assertInsideBranch(companyId: number, employeeId: number, point: { lat: number | null; lng: number | null; accuracyM: number | null }) {
  const [row] = await db
    .select({ name: branches.name, lat: branches.latitude, lng: branches.longitude, radius: branches.radius_m, on: branches.geofence_enabled, active: branches.is_active })
    .from(employees)
    .innerJoin(branches, eq(branches.id, employees.branch_id))
    .where(and(eq(employees.company_id, companyId), eq(employees.id, employeeId)));
  if (!row || !row.on || !row.active || row.lat == null || row.lng == null) return; // no geofence to check
  if (point.lat == null || point.lng == null) throw new BadRequestError(`Allow location access — office check-in at ${row.name} needs your location`);
  const away = distanceM(point.lat, point.lng, row.lat, row.lng);
  const slack = Math.min(point.accuracyM ?? 0, 100);
  if (away - slack > row.radius) {
    throw new BadRequestError(`You're about ${fmt(away)} from ${row.name} — office check-in works within ${fmt(row.radius)}. Move closer or pick another location.`);
  }
}

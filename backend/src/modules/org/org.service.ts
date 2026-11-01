// Org chart: reporting tree (loaded a level at a time), departments and their members
import { and, asc, count, desc, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { branches, departments, designations, employees } from "../../db/schema.js";
import { NotFoundError } from "../../utils/httpErrors.js";
import { offsetOf, pageMeta } from "../../utils/pagination.js";

const current = (companyId: number) => and(eq(employees.company_id, companyId), ne(employees.status, "exited"));

// Direct reports who haven't left
const reportCount = sql<number>`(select count(*)::int from employees r where r.manager_id = ${employees.id} and r.status <> 'exited')`;

const nodeColumns = {
  id: employees.id,
  name: employees.name,
  photo_url: employees.photo_url,
  designation: designations.name,
  department: departments.name,
  report_count: reportCount,
};

const nodes = () =>
  db.select(nodeColumns).from(employees).leftJoin(designations, eq(designations.id, employees.designation_id)).leftJoin(departments, eq(departments.id, employees.department_id));

// GET /api/org-chart
export async function overview(companyId: number, myEmployeeId: number | null) {
  const [[{ total }], [{ leaders }], levelsRow, deptRows, [{ noDept }], roots, [{ unassigned }]] = await Promise.all([
    db.select({ total: count() }).from(employees).where(current(companyId)),
    db.select({ leaders: sql<number>`count(*)::int` }).from(employees).where(and(current(companyId), sql`${reportCount} > 0`)),
    db.execute<{ levels: number | null }>(sql`
      with recursive t as (
        select e.id, 1 as lvl from employees e
        where e.company_id = ${companyId} and e.status <> 'exited'
          and (e.manager_id is null or not exists (select 1 from employees m where m.id = e.manager_id and m.status <> 'exited'))
        union all
        select e.id, t.lvl + 1 from employees e join t on e.manager_id = t.id
        where e.status <> 'exited' and t.lvl < 30
      ) select max(lvl)::int as levels from t`),
    db
      .select({ id: departments.id, name: departments.name, count: sql<number>`(${count(employees.id)})::int` })
      .from(departments)
      .leftJoin(employees, and(eq(employees.department_id, departments.id), ne(employees.status, "exited")))
      .where(eq(departments.company_id, companyId))
      .groupBy(departments.id)
      .orderBy(desc(sql`count(${employees.id})`), asc(departments.name)),
    db.select({ noDept: count() }).from(employees).where(and(current(companyId), isNull(employees.department_id))),
    // Top of the tree: people with no (current) manager who lead someone
    nodes()
      .where(and(current(companyId), sql`${reportCount} > 0`, sql`(${employees.manager_id} is null or not exists (select 1 from employees m where m.id = ${employees.manager_id} and m.status <> 'exited'))`))
      .orderBy(desc(reportCount), asc(employees.name)),
    db
      .select({ unassigned: count() })
      .from(employees)
      .where(and(current(companyId), isNull(employees.manager_id), sql`${reportCount} = 0`)),
  ]);
  const rows = (levelsRow as unknown as { rows?: { levels: number | null }[] }).rows ?? (levelsRow as unknown as { levels: number | null }[]);
  return {
    stats: { total, departments: deptRows.length, leaders, levels: rows[0]?.levels ?? 0 },
    me: myEmployeeId ? await myChain(companyId, myEmployeeId) : null,
    roots,
    unassigned,
    departments: [...deptRows, ...(noDept ? [{ id: null, name: "No department", count: noDept }] : [])],
  };
}

// My managers (top first), me, and my direct reports
async function myChain(companyId: number, employeeId: number) {
  const [self] = await nodes().where(and(eq(employees.company_id, companyId), eq(employees.id, employeeId)));
  if (!self) return null;
  const managers: typeof self[] = [];
  let next = (await db.select({ m: employees.manager_id }).from(employees).where(eq(employees.id, employeeId)))[0]?.m ?? null;
  for (let i = 0; next && i < 20; i++) {
    const [m] = await nodes().where(and(eq(employees.company_id, companyId), eq(employees.id, next)));
    if (!m || managers.some((x) => x.id === m.id)) break; // gone, or a loop
    managers.unshift(m);
    next = (await db.select({ m: employees.manager_id }).from(employees).where(eq(employees.id, m.id)))[0]?.m ?? null;
  }
  return { managers, self, reports: await reportsOf(companyId, employeeId) };
}

// GET /api/org-chart/:id/reports
export async function reportsOf(companyId: number, managerId: number) {
  return nodes().where(and(current(companyId), eq(employees.manager_id, managerId))).orderBy(desc(reportCount), asc(employees.name));
}

// GET /api/org-chart/departments/:id/members?page&limit&search  (id "none" = no department)
export async function departmentMembers(companyId: number, departmentId: number | "none", q: { page: number; limit: number; search?: string }) {
  let name = "No department";
  if (departmentId !== "none") {
    const [d] = await db.select({ name: departments.name }).from(departments).where(and(eq(departments.company_id, companyId), eq(departments.id, departmentId)));
    if (!d) throw new NotFoundError("Department not found");
    name = d.name;
  }
  const filters = [current(companyId)!, departmentId === "none" ? isNull(employees.department_id) : eq(employees.department_id, departmentId)];
  if (q.search) {
    const like = `%${q.search.replace(/[%_\\]/g, "\\$&")}%`;
    filters.push(or(ilike(employees.name, like), ilike(employees.employee_code, like), ilike(designations.name, like))!);
  }
  const where = and(...filters);
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        id: employees.id,
        name: employees.name,
        photo_url: employees.photo_url,
        employee_code: employees.employee_code,
        designation: designations.name,
        branch: branches.name,
        manager_name: sql<string | null>`(select m.name from employees m where m.id = ${employees.manager_id})`,
        join_date: employees.join_date,
        status: employees.status,
        report_count: reportCount,
      })
      .from(employees)
      .leftJoin(designations, eq(designations.id, employees.designation_id))
      .leftJoin(branches, eq(branches.id, employees.branch_id))
      .where(where)
      .orderBy(desc(reportCount), asc(employees.name))
      .limit(q.limit)
      .offset(offsetOf(q.page, q.limit)),
    db.select({ n: count() }).from(employees).leftJoin(designations, eq(designations.id, employees.designation_id)).where(where),
  ]);
  return { department: { id: departmentId === "none" ? null : departmentId, name }, members: rows, ...pageMeta(q.page, q.limit, n) };
}

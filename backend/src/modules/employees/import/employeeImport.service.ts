import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../../../config/db.js";
import { departments, designations, employees, roles, shifts, users } from "../../../db/schema.js";
import type { EmploymentType } from "../../../db/schemas/employee.schema.js";
import { audit } from "../../../utils/audit.js";
import { can } from "../../../utils/can.js";
import { BadRequestError } from "../../../utils/httpErrors.js";
import { passwordError } from "../../../utils/passwordPolicy.js";
import { readSheet, sheetFormat } from "../../../utils/sheetReader.js";
import { syncSubscriptionQuantity } from "../../billing/billing.service.js";
import { findOrCreateDepartment } from "../../departments/departments.service.js";
import { findOrCreateDesignation } from "../../designations/designations.service.js";
import { createUser } from "../../users/users.service.js";
import { columnFor, IMPORT_COLUMNS, norm, type ImportKey } from "./importColumns.js";

export const MAX_IMPORT_ROWS = 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// What the preview shows for each row
export interface ImportRow {
  line: number;
  name: string;
  code: string;
  email: string;
  designation: string;
  department: string;
  manager: string;
  login: boolean;
  errors: string[];
  notes: string[];
}

interface Planned {
  row: ImportRow;
  values: Omit<typeof employees.$inferInsert, "company_id" | "designation_id" | "department_id" | "manager_id">;
  designation: string | null;
  department: string | null;
  manager: { existingId: number } | { fileIndex: number } | null;
  password: string | null;
}

// ---- Value parsing ----

const pad = (n: number) => String(n).padStart(2, "0");

function toIsoDate(s: string): string | null {
  let y: number, m: number, d: number;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) [y, m, d] = [+match[1], +match[2], +match[3]];
  else if ((match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s))) [d, m, y] = [+match[1], +match[2], +match[3]];
  else if ((match = /^(\d{1,2})[\s-]([a-z]{3,9})[\s,-]+(\d{4})$/i.exec(s))) {
    const mi = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase());
    if (mi < 0) return null;
    [d, m, y] = [+match[1], mi + 1, +match[3]];
  } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || y < 1900) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

const GENDERS: Record<string, "male" | "female" | "other"> = { m: "male", male: "male", f: "female", female: "female", o: "other", other: "other" };
const TYPES: Record<string, EmploymentType> = {
  fulltime: "full_time",
  ft: "full_time",
  permanent: "full_time",
  parttime: "part_time",
  pt: "part_time",
  contract: "contract",
  contractual: "contract",
  consultant: "contract",
  intern: "intern",
  internship: "intern",
  trainee: "intern",
};

// ---- Check ----

async function load(companyId: number) {
  const [emps, desigs, depts, shiftRows, roleRows] = await Promise.all([
    db
      .select({ id: employees.id, name: employees.name, code: employees.employee_code, email: employees.email, status: employees.status })
      .from(employees)
      .where(eq(employees.company_id, companyId)),
    db.select({ id: designations.id, name: designations.name, active: designations.is_active }).from(designations).where(eq(designations.company_id, companyId)),
    db.select({ id: departments.id, name: departments.name, active: departments.is_active }).from(departments).where(eq(departments.company_id, companyId)),
    db.select({ id: shifts.id, name: shifts.name, active: shifts.is_active }).from(shifts).where(eq(shifts.company_id, companyId)),
    db.select().from(roles).where(or(isNull(roles.company_id), eq(roles.company_id, companyId))),
  ]);
  const byKey = <T>(rows: T[], key: (r: T) => string | null) => new Map(rows.filter((r) => key(r)).map((r) => [key(r)!.toLowerCase(), r]));
  return {
    byCode: byKey(emps, (e) => e.code),
    byEmail: byKey(emps, (e) => e.email),
    names: new Set(emps.map((e) => e.name.toLowerCase())),
    desigs: byKey(desigs, (d) => d.name),
    depts: byKey(depts, (d) => d.name),
    shifts: byKey(shiftRows, (s) => s.name),
    roles: roleRows,
  };
}

// Reads and checks the file; nothing is saved
async function analyse(companyId: number, actor: Express.AuthUser, file: Express.Multer.File | undefined) {
  if (!file) throw new BadRequestError("Choose a CSV or Excel (.xlsx) file");
  const format = sheetFormat(file.originalname);
  if (!format) throw new BadRequestError("Upload a .csv or .xlsx file — download the template to start");
  const sheet = await readSheet(file.buffer, format);
  if (sheet.length === 0) throw new BadRequestError("The file is empty");

  const [header, ...body] = sheet;
  const keys = header.cells.map((h) => columnFor(h.replace(/\*/g, "")));
  if (!keys.includes("name")) throw new BadRequestError("The file needs a Name column — download the template and fill it in");
  const ignored = header.cells.filter((h, i) => h && !keys[i]);
  if (body.length === 0) throw new BadRequestError("The file has a header row but no employees");
  if (body.length > MAX_IMPORT_ROWS) throw new BadRequestError(`A file can have up to ${MAX_IMPORT_ROWS} employees — this one has ${body.length}. Split it into smaller files.`);

  const ctx = await load(companyId);
  const defaultRole = ctx.roles.find((r) => r.key === "employee" && r.company_id === null) ?? null;
  const canLogin = can(actor, "users.manage");

  const planned: Planned[] = body.map(({ line, cells }) => {
    const get = (k: ImportKey) => {
      const i = keys.indexOf(k);
      return i < 0 ? "" : (cells[i] ?? "").trim();
    };
    const errors: string[] = [];
    const notes: string[] = [];
    const tooLong = (label: string, v: string, max: number) => v.length > max && errors.push(`${label} can be at most ${max} characters`);

    const name = get("name").replace(/\s+/g, " ");
    if (!name) errors.push("Name is required");
    tooLong("Name", name, 150);
    // Namesakes are allowed, but it may be a repeat import
    if (name && ctx.names.has(name.toLowerCase())) notes.push(`An employee named ${name} already exists`);

    const code = get("code");
    tooLong("Employee code", code, 40);
    if (code && ctx.byCode.has(code.toLowerCase())) errors.push(`Employee code ${code} is already used by ${ctx.byCode.get(code.toLowerCase())!.name}`);

    const email = get("email").toLowerCase();
    if (email && !EMAIL.test(email)) errors.push(`"${get("email")}" isn't a valid email`);
    tooLong("Email", email, 150);
    if (email && ctx.byEmail.has(email)) errors.push(`${ctx.byEmail.get(email)!.name} already has this email — imported before?`);

    const phone = get("phone");
    tooLong("Phone", phone, 30);
    const emergencyPhone = get("emergencyPhone");
    tooLong("Emergency contact phone", emergencyPhone, 30);
    const emergencyName = get("emergencyName");
    tooLong("Emergency contact name", emergencyName, 150);

    const genderRaw = get("gender");
    const gender = genderRaw ? GENDERS[norm(genderRaw)] : null;
    if (genderRaw && !gender) errors.push("Gender must be Male, Female or Other");

    const typeRaw = get("type");
    const type = typeRaw ? TYPES[norm(typeRaw)] : "full_time";
    if (!type) errors.push("Employment type must be Full time, Part time, Contract or Intern");

    const date = (k: ImportKey, label: string) => {
      const raw = get(k);
      if (!raw) return null;
      const iso = toIsoDate(raw);
      if (!iso) errors.push(`${label} "${raw}" isn't a date — use DD/MM/YYYY`);
      return iso;
    };
    const dob = date("dob", "Date of birth");
    const joinDate = date("joinDate", "Join date");
    if (dob && dob >= new Date().toISOString().slice(0, 10)) errors.push("Date of birth must be in the past");

    const salaryRaw = get("salary").replace(/[₹,\s]|rs\.?|inr/gi, "");
    const salary = salaryRaw ? Number(salaryRaw) : null;
    if (salaryRaw && (!Number.isFinite(salary) || salary! < 0)) errors.push(`Monthly salary "${get("salary")}" isn't a number`);

    // Job title / department: existing (must be active) or added on import
    const lookup = (raw: string, map: Map<string, { name: string; active: boolean }>, label: string) => {
      if (!raw) return null;
      const hit = map.get(raw.toLowerCase());
      if (hit && !hit.active) errors.push(`${label} "${hit.name}" is inactive`);
      if (!hit) notes.push(`New ${label.toLowerCase()} "${raw}" will be added`);
      tooLong(label, raw, 100);
      return hit?.name ?? raw;
    };
    const designation = lookup(get("designation"), ctx.desigs, "Designation");
    const department = lookup(get("department"), ctx.depts, "Department");

    const shiftRaw = get("shift");
    const shift = shiftRaw ? ctx.shifts.get(shiftRaw.toLowerCase()) : null;
    if (shiftRaw && !shift) errors.push(`No shift called "${shiftRaw}" — add it under Shifts first`);
    else if (shift && !shift.active) errors.push(`Shift "${shift.name}" is inactive`);

    const roleRaw = get("role");
    // Name first (custom roles share their base's key), then a system key like "hr"
    const role = roleRaw ? (ctx.roles.find((r) => norm(r.name) === norm(roleRaw)) ?? ctx.roles.find((r) => r.company_id === null && norm(r.key) === norm(roleRaw))) : defaultRole;
    if (roleRaw && !role) errors.push(`No role called "${roleRaw}"`);
    else if (role && roleRaw) {
      if (role.key === "superadmin") errors.push("Super Admin can't be given from the app");
      else if (!role.is_active) errors.push(`The ${role.name} role is inactive`);
      else if (!actor.isSuperadmin && role.level > actor.level) errors.push(`You can't give the ${role.name} role`);
    }

    const password = get("password") || null;
    if (password) {
      if (!canLogin) errors.push("You can't create logins — leave Temporary password empty");
      else if (!email) errors.push("Add an email — they log in with it");
      else {
        const bad = passwordError(password);
        if (bad) errors.push(bad);
      }
    }

    return {
      row: { line, name, code, email, designation: designation ?? "", department: department ?? "", manager: get("manager"), login: Boolean(password), errors, notes },
      values: {
        name,
        employee_code: code || null,
        email: email || null,
        phone: phone || null,
        gender: gender ?? null,
        date_of_birth: dob,
        join_date: joinDate,
        shift_id: shift?.id ?? null,
        role_id: role?.id ?? null,
        employment_type: type ?? "full_time",
        salary: salary == null || !Number.isFinite(salary) ? null : String(salary),
        address: get("address") || null,
        emergency_contact_name: emergencyName || null,
        emergency_contact_phone: emergencyPhone || null,
      },
      designation,
      department,
      manager: null,
      password,
    };
  });

  // Duplicates inside the file
  const seen = (key: (p: Planned) => string, label: string) => {
    const first = new Map<string, number>();
    for (const p of planned) {
      const k = key(p);
      if (!k) continue;
      if (first.has(k)) p.row.errors.push(`Same ${label} as row ${first.get(k)}`);
      else first.set(k, p.row.line);
    }
  };
  seen((p) => p.row.code.toLowerCase(), "employee code");
  seen((p) => p.row.email, "email");

  // Emails that already have a login anywhere
  const loginEmails = planned.filter((p) => p.password && p.row.email).map((p) => p.row.email);
  if (loginEmails.length) {
    const taken = await db
      .select({ email: users.email })
      .from(users)
      .where(inArray(sql`lower(${users.email})`, loginEmails));
    const set = new Set(taken.map((t) => t.email.toLowerCase()));
    for (const p of planned) if (p.password && set.has(p.row.email)) p.row.errors.push("An account with this email already exists");
  }

  // Reports to: an existing employee, or another row of this file
  const fileByRef = new Map<string, number>();
  planned.forEach((p, i) => {
    // First row wins when a code / email repeats
    for (const ref of [p.row.code.toLowerCase(), p.row.email]) if (ref && !fileByRef.has(ref)) fileByRef.set(ref, i);
  });
  planned.forEach((p, i) => {
    const ref = p.row.manager.toLowerCase();
    if (!ref) return;
    const existing = ctx.byCode.get(ref) ?? ctx.byEmail.get(ref);
    if (existing) {
      if (existing.status === "exited") p.row.errors.push(`Reports to ${existing.name}, who has left`);
      else {
        p.manager = { existingId: existing.id };
        p.row.manager = existing.name;
      }
      return;
    }
    const idx = fileByRef.get(ref);
    if (idx === undefined) p.row.errors.push(`Reports to "${p.row.manager}" — no employee with that code or email`);
    else if (idx === i) p.row.errors.push("An employee can't report to themselves");
    else {
      p.manager = { fileIndex: idx };
      p.row.manager = planned[idx].row.name || p.row.manager;
    }
  });
  // A manager row that can't be imported blocks the rows reporting to it
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of planned) {
      if (p.manager && "fileIndex" in p.manager && planned[p.manager.fileIndex].row.errors.length && !p.row.errors.length) {
        p.row.errors.push(`Their manager (row ${planned[p.manager.fileIndex].row.line}) has errors`);
        changed = true;
      }
    }
  }

  const ready = planned.filter((p) => p.row.errors.length === 0).length;
  return { planned, ignored, summary: { total: planned.length, ready, invalid: planned.length - ready } };
}

// POST /employees/import/check → the preview
export async function checkImport(companyId: number, actor: Express.AuthUser, file: Express.Multer.File | undefined) {
  const { planned, ignored, summary } = await analyse(companyId, actor, file);
  return { summary, ignoredColumns: ignored, rows: planned.map((p) => p.row) };
}

// POST /employees/import → saves the rows without errors (rows with errors are skipped)
export async function runImport(companyId: number, actor: Express.AuthUser, file: Express.Multer.File | undefined) {
  const { planned, summary } = await analyse(companyId, actor, file);
  const ready = planned.filter((p) => p.row.errors.length === 0);
  if (!ready.length) throw new BadRequestError("No rows can be imported — fix the errors and upload again");

  // Job titles / departments: create new names once
  const desigIds = new Map<string, number>();
  const deptIds = new Map<string, number>();
  for (const p of ready) {
    if (p.designation && !desigIds.has(p.designation.toLowerCase())) desigIds.set(p.designation.toLowerCase(), (await findOrCreateDesignation(companyId, p.designation)).id);
    if (p.department && !deptIds.has(p.department.toLowerCase())) deptIds.set(p.department.toLowerCase(), (await findOrCreateDepartment(companyId, p.department)).id);
  }

  // All employees in one transaction: insert, then link managers
  const indexOf = new Map(planned.map((p, i) => [p, i]));
  const idByIndex = new Map<number, number>();
  await db.transaction(async (tx) => {
    for (let start = 0; start < ready.length; start += 200) {
      const chunk = ready.slice(start, start + 200);
      const inserted = await tx
        .insert(employees)
        .values(
          chunk.map((p) => ({
            ...p.values,
            company_id: companyId,
            designation_id: p.designation ? desigIds.get(p.designation.toLowerCase())! : null,
            department_id: p.department ? deptIds.get(p.department.toLowerCase())! : null,
          })),
        )
        .returning({ id: employees.id });
      chunk.forEach((p, i) => idByIndex.set(indexOf.get(p)!, inserted[i].id));
    }
    const byManager = new Map<number, number[]>();
    for (const p of ready) {
      if (!p.manager) continue;
      const managerId = "existingId" in p.manager ? p.manager.existingId : idByIndex.get(p.manager.fileIndex)!;
      byManager.set(managerId, [...(byManager.get(managerId) ?? []), idByIndex.get(indexOf.get(p)!)!]);
    }
    for (const [managerId, ids] of byManager) {
      await tx.update(employees).set({ manager_id: managerId }).where(and(eq(employees.company_id, companyId), inArray(employees.id, ids)));
    }
  });

  // Logins after the employees exist; a failure here doesn't undo the import
  let logins = 0;
  const loginFailures: { line: number; name: string; message: string }[] = [];
  for (const p of ready) {
    if (!p.password || !p.values.email) continue;
    try {
      await createUser(companyId, actor, { name: p.values.name, email: p.values.email, password: p.password, employeeId: idByIndex.get(indexOf.get(p)!)! });
      logins++;
    } catch (err) {
      loginFailures.push({ line: p.row.line, name: p.row.name, message: (err as Error).message });
    }
  }

  await syncSubscriptionQuantity(companyId);
  audit(actor, {
    companyId,
    action: "employee.imported",
    summary: `Imported ${ready.length} employee${ready.length === 1 ? "" : "s"} from ${file!.originalname}${summary.invalid ? ` (${summary.invalid} skipped)` : ""}`,
    meta: { file: file!.originalname, imported: ready.length, skipped: summary.invalid, logins },
  });
  return { imported: ready.length, skipped: summary.invalid, logins, loginFailures };
}

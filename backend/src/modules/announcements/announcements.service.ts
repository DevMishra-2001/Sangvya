import { and, asc, desc, eq, getTableColumns, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { can } from "../../config/permissions.js";
import { announcements, designations, employees, users } from "../../db/schema.js";
import { ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { localDate } from "../../utils/workday.js";
import type { CreateAnnouncementInput } from "./announcements.schema.js";

// Author can delete their own; HR/superadmin can delete any
const canDelete = (user: Express.AuthUser, createdBy: number | null) => createdBy === user.id || can(user.role, "users.manage");

// Employees whose birthday is today (company timezone), sorted by name.
// 29 Feb birthdays are celebrated on 28 Feb in non-leap years.
async function todaysBirthdays(companyId: number) {
  const today = localDate(); // "YYYY-MM-DD"
  const year = Number(today.slice(0, 4));
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const monthDays = [today.slice(5)];
  if (!isLeap && today.slice(5) === "02-28") monthDays.push("02-29");

  const rows = await db
    .select({ id: employees.id, name: employees.name, designation: designations.name })
    .from(employees)
    .leftJoin(designations, eq(designations.id, employees.designation_id))
    .where(
      and(
        eq(employees.company_id, companyId),
        isNotNull(employees.date_of_birth),
        inArray(sql`to_char(${employees.date_of_birth}, 'MM-DD')`, monthDays),
      ),
    )
    .orderBy(asc(employees.name));
  return rows.map((e) => ({ employeeId: e.id, name: e.name, designation: e.designation }));
}

// Announcements + today's birthdays for the dashboard
export async function getFeed(companyId: number, user: Express.AuthUser) {
  const rows = await db
    .select({ ...getTableColumns(announcements), created_by_name: users.name })
    .from(announcements)
    .leftJoin(users, eq(users.id, announcements.created_by))
    .where(eq(announcements.company_id, companyId))
    .orderBy(desc(announcements.created_at))
    .limit(20);
  return {
    announcements: rows.map((a) => ({ ...a, canDelete: canDelete(user, a.created_by) })),
    birthdays: await todaysBirthdays(companyId),
  };
}

export async function createAnnouncement(companyId: number, user: Express.AuthUser, { title, message }: CreateAnnouncementInput) {
  const [announcement] = await db
    .insert(announcements)
    .values({ company_id: companyId, title, message: message || null, created_by: user.id })
    .returning();
  return { announcement: { ...announcement, created_by_name: null, canDelete: true } };
}

export async function deleteAnnouncement(companyId: number, user: Express.AuthUser, id: number) {
  const [existing] = await db
    .select()
    .from(announcements)
    .where(and(eq(announcements.company_id, companyId), eq(announcements.id, id)));
  if (!existing) throw new NotFoundError("Announcement not found");
  if (!canDelete(user, existing.created_by)) throw new ForbiddenError("You can only delete your own announcements");
  await db.delete(announcements).where(eq(announcements.id, existing.id));
}

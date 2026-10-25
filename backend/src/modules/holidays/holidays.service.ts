import { and, asc, between, eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { holidays } from "../../db/schema.js";
import { ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import type { CreateHolidayInput } from "./holidays.schema.js";

export type Holiday = typeof holidays.$inferSelect;

export async function findHolidayByDate(companyId: number, date: string): Promise<Holiday | undefined> {
  const [holiday] = await db.select().from(holidays).where(and(eq(holidays.company_id, companyId), eq(holidays.date, date)));
  return holiday;
}

export function findHolidaysInRange(companyId: number, from: string, to: string) {
  return db
    .select()
    .from(holidays)
    .where(and(eq(holidays.company_id, companyId), between(holidays.date, from, to)))
    .orderBy(asc(holidays.date));
}

export async function listHolidays(companyId: number) {
  const rows = await db.select().from(holidays).where(eq(holidays.company_id, companyId)).orderBy(asc(holidays.date));
  return { holidays: rows };
}

export async function createHoliday(companyId: number, { date, name }: CreateHolidayInput) {
  if (await findHolidayByDate(companyId, date)) throw new ConflictError("There's already a holiday on this date");
  const [holiday] = await db.insert(holidays).values({ company_id: companyId, date, name }).returning();
  return { holiday };
}

export async function deleteHoliday(companyId: number, id: number) {
  const [deleted] = await db
    .delete(holidays)
    .where(and(eq(holidays.company_id, companyId), eq(holidays.id, id)))
    .returning({ id: holidays.id });
  if (!deleted) throw new NotFoundError("Holiday not found");
}

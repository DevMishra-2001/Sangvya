// Company holidays.
import { and, asc, between, eq, ne } from "drizzle-orm";
import { db } from "../../config/db.js";
import { holidays } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import { workCalendar } from "../companies/workCalendar.js";
import { companyRecipients, notify } from "../notifications/notify.js";
import type { CreateHolidayInput } from "./holidays.schema.js";

export type Holiday = typeof holidays.$inferSelect;

// Any holiday on that date (optional ones included) — for showing it
export async function findHolidayByDate(companyId: number, date: string): Promise<Holiday | undefined> {
  const [holiday] = await db.select().from(holidays).where(and(eq(holidays.company_id, companyId), eq(holidays.date, date)));
  return holiday;
}

// Is that date a day off for everyone? (a holiday that isn't optional)
export async function findDayOffHoliday(companyId: number, date: string): Promise<Holiday | undefined> {
  const h = await findHolidayByDate(companyId, date);
  return h && !h.is_optional ? h : undefined;
}

export function findHolidaysInRange(companyId: number, from: string, to: string) {
  return db
    .select()
    .from(holidays)
    .where(and(eq(holidays.company_id, companyId), between(holidays.date, from, to)))
    .orderBy(asc(holidays.date));
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// GET /api/holidays?year= — the list for a year (all by default) + the weekly offs
export async function listHolidays(companyId: number, year?: number) {
  const rows = year
    ? await findHolidaysInRange(companyId, `${year}-01-01`, `${year}-12-31`)
    : await db.select().from(holidays).where(eq(holidays.company_id, companyId)).orderBy(asc(holidays.date));
  const cal = await workCalendar(companyId);
  return { holidays: rows, weeklyOffs: cal.offDows.map((d) => DAY_NAMES[d]) };
}

const when = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export async function createHoliday(companyId: number, actor: Express.AuthUser, { date, name, isOptional }: CreateHolidayInput) {
  if (await findHolidayByDate(companyId, date)) throw new ConflictError("There's already a holiday on this date");
  const [holiday] = await db.insert(holidays).values({ company_id: companyId, date, name, is_optional: isOptional }).returning();
  audit(actor, { companyId, action: "holiday.created", target: ["holiday", holiday.id], summary: `Added the ${isOptional ? "optional " : ""}holiday ${name} on ${date}` });
  // Everyone hears about upcoming holidays (bell only)
  if (date >= new Date().toISOString().slice(0, 10)) {
    void (async () =>
      notify({
        companyId,
        to: await companyRecipients(companyId),
        type: "holiday.added",
        title: `${isOptional ? "Optional holiday" : "Holiday"}: ${name}`,
        body: `${when(date)}${isOptional ? " — take it with your OL if you like" : " — office closed"}`,
        link: "/my-attendance/holidays",
        entity: ["holiday", holiday.id],
        actorId: actor.id,
      }))();
  }
  return { holiday };
}

export async function updateHoliday(companyId: number, actor: Express.AuthUser, id: number, { date, name, isOptional }: CreateHolidayInput) {
  const [clash] = await db
    .select({ id: holidays.id })
    .from(holidays)
    .where(and(eq(holidays.company_id, companyId), eq(holidays.date, date), ne(holidays.id, id)));
  if (clash) throw new ConflictError("There's already a holiday on this date");
  const [holiday] = await db
    .update(holidays)
    .set({ date, name, is_optional: isOptional })
    .where(and(eq(holidays.company_id, companyId), eq(holidays.id, id)))
    .returning();
  if (!holiday) throw new NotFoundError("Holiday not found");
  audit(actor, { companyId, action: "holiday.updated", target: ["holiday", id], summary: `Updated the holiday ${name} (${date}${isOptional ? ", optional" : ""})` });
  return { holiday };
}

export async function deleteHoliday(companyId: number, actor: Express.AuthUser, id: number) {
  const [deleted] = await db
    .delete(holidays)
    .where(and(eq(holidays.company_id, companyId), eq(holidays.id, id)))
    .returning({ id: holidays.id, name: holidays.name, date: holidays.date });
  if (!deleted) throw new NotFoundError("Holiday not found");
  audit(actor, { companyId, action: "holiday.removed", target: ["holiday", id], summary: `Removed the holiday ${deleted.name} (${deleted.date})` });
}

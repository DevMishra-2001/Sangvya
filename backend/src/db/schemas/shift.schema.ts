import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, smallint, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id } from "../columns.js";
import { companies } from "./company.schema.js";

// Working hours ("General 09:00–18:00", "Night 22:00–07:00").
export const shifts = pgTable(
  "shifts",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    name: varchar("name", { length: 60 }).notNull(),
    start_time: varchar("start_time", { length: 5 }).notNull(), // "09:00"
    end_time: varchar("end_time", { length: 5 }).notNull(), // "18:00"
    // Checking in up to this many minutes after the start isn't late
    grace_minutes: smallint("grace_minutes").notNull().default(10),
    // Total break time allowed in the day
    break_minutes: smallint("break_minutes").notNull().default(60),
    is_default: boolean("is_default").notNull().default(false),
    is_active: boolean("is_active").notNull().default(true),
    created_at: createdAt(),
  },
  (t) => [
    fk("shifts", t.company_id, companies.id, "cascade"),
    index("idx_shifts_company").on(t.company_id),
    uniqueIndex("idx_shifts_name").on(t.company_id, sql`lower(${t.name})`),
    // At most one default per company
    uniqueIndex("idx_shifts_default").on(t.company_id).where(sql`${t.is_default}`),
  ],
);

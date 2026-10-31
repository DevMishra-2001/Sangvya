import { sql } from "drizzle-orm";
import { boolean, doublePrecision, index, integer, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id } from "../columns.js";
import { companies } from "./company.schema.js";

// A company's offices / branches. Office check-ins must be inside the branch's geofence.
export const branches = pgTable(
  "branches",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 20 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    country: varchar("country", { length: 100 }),
    postal_code: varchar("postal_code", { length: 20 }),
    phone: varchar("phone", { length: 30 }),
    email: varchar("email", { length: 150 }),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    radius_m: integer("radius_m").notNull().default(200), // geofence radius in metres
    geofence_enabled: boolean("geofence_enabled").notNull().default(false),
    is_head_office: boolean("is_head_office").notNull().default(false),
    is_active: boolean("is_active").notNull().default(true),
    created_at: createdAt(),
  },
  (t) => [
    fk("branches", t.company_id, companies.id, "cascade"),
    index("idx_branches_company").on(t.company_id),
    uniqueIndex("idx_branches_name").on(t.company_id, sql`lower(${t.name})`),
  ],
);

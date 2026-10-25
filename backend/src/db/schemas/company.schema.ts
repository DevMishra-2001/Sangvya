import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createdAt, id } from "../columns.js";

// One row per customer (tenant). Every business table carries a company_id —
// this is how one database serves many companies while keeping data isolated.
export const companies = pgTable("companies", {
  id: id(),
  name: varchar("name", { length: 200 }).notNull(),
  industry: varchar("industry", { length: 100 }),
  logo_url: text("logo_url"),
  // Headcount band picked at sign-up, e.g. "11-50" (see EMPLOYEE_RANGES)
  employee_range: varchar("employee_range", { length: 20 }),
  website: varchar("website", { length: 200 }),
  email: varchar("email", { length: 150 }),
  phone: varchar("phone", { length: 30 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
  postal_code: varchar("postal_code", { length: 20 }),
  created_at: createdAt(),
});

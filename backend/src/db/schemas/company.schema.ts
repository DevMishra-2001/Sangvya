import { integer, pgTable, smallint, text, varchar } from "drizzle-orm/pg-core";
import { createdAt, id, timestamptz } from "../columns.js";

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

  // ---- More company details (setup wizard) ----
  legal_name: varchar("legal_name", { length: 200 }),
  // pvt_ltd | public_ltd | llp | partnership | proprietorship | trust_ngo | other
  business_type: varchar("business_type", { length: 30 }),
  year_established: smallint("year_established"),
  office_locations: text("office_locations"),
  timezone: varchar("timezone", { length: 60 }),
  // Legal & billing (India IDs are format-checked; verification is separate)
  pan: varchar("pan", { length: 10 }),
  gstin: varchar("gstin", { length: 15 }),
  cin_llpin: varchar("cin_llpin", { length: 21 }),
  tan: varchar("tan", { length: 10 }),
  billing_address: text("billing_address"),
  // unverified | pending | verified | rejected (reviewed by the Super Admin)
  verification_status: varchar("verification_status", { length: 20 }).notNull().default("unverified"),
  verification_notes: text("verification_notes"),
  verified_at: timestamptz("verified_at"),
  // active | suspended — a suspended company's users can't use it (Super Admin decides)
  status: varchar("status", { length: 20 }).notNull().default("active"),
  status_reason: text("status_reason"),
  status_changed_at: timestamptz("status_changed_at"),
  // Super Admin who last changed verification or status (no FK: users ↔ companies already reference each other)
  reviewed_by: integer("reviewed_by"),
  // Workplace defaults
  work_days: varchar("work_days", { length: 30 }), // "mon,tue,wed,thu,fri"
  office_start: varchar("office_start", { length: 5 }), // "09:30"
  office_end: varchar("office_end", { length: 5 }),
  attendance_mode: varchar("attendance_mode", { length: 20 }), // office | remote | hybrid | field
  leave_year: varchar("leave_year", { length: 20 }), // calendar | financial
  fiscal_year_start: smallint("fiscal_year_start"), // month 1–12
  currency: varchar("currency", { length: 3 }),
  employee_id_prefix: varchar("employee_id_prefix", { length: 10 }),
  created_at: createdAt(),
});

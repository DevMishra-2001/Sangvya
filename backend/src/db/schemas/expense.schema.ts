import { sql } from "drizzle-orm";
import { date, index, integer, jsonb, numeric, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";
import { users } from "./user.schema.js";

const money = (name: string) => numeric(name, { precision: 12, scale: 2 });

export const ADVANCE_TYPES = ["salary", "tada"] as const;
export const ADVANCE_STATUSES = ["pending", "approved", "on_hold", "rejected", "paid", "cancelled"] as const;
export const CLAIM_STATUSES = ["draft", "submitted", "approved", "on_hold", "rejected", "paid"] as const;
export const TRAVEL_TYPES = ["cab", "auto", "bus", "metro", "train", "flight", "own_car", "own_bike", "other"] as const;

export type Attachment = { path: string; name: string };

// Money an employee asks for up front: against salary (recovered in payroll) or for TA/DA (settled by expense claims)
export const expenseAdvances = pgTable(
  "expense_advances",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    advance_type: varchar("advance_type", { length: 10 }).notNull().$type<(typeof ADVANCE_TYPES)[number]>(),
    amount: money("amount").notNull(),
    purpose: text("purpose").notNull(),
    expected_date: date("expected_date"),
    ifsc: varchar("ifsc", { length: 11 }),
    account_number: varchar("account_number", { length: 18 }),
    bank_name: varchar("bank_name", { length: 120 }),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default(sql`'[]'::jsonb`),
    status: varchar("status", { length: 10 }).notNull().default("pending").$type<(typeof ADVANCE_STATUSES)[number]>(),
    decision_note: text("decision_note"), // the approver's note, shown to the employee
    decided_by: integer("decided_by"),
    decided_at: timestamptz("decided_at"),
    paid_amount: money("paid_amount"),
    paid_on: date("paid_on"),
    payment_ref: varchar("payment_ref", { length: 80 }),
    paid_by: integer("paid_by"),
    loan_id: integer("loan_id"), // salary advance → payroll recovery
    created_at: createdAt(),
  },
  (t) => [
    fk("expense_advances", t.company_id, companies.id, "cascade"),
    fk("expense_advances", t.employee_id, employees.id, "cascade"),
    fk("expense_advances", t.decided_by, users.id, "set null"),
    fk("expense_advances", t.paid_by, users.id, "set null"),
    index("idx_expense_advances_company").on(t.company_id, t.status),
    index("idx_expense_advances_employee").on(t.employee_id),
  ],
);

// One expense claim (a trip / visit) with its sections; travel lines are in expense_travel_lines
export const expenseClaims = pgTable(
  "expense_claims",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    claim_date: date("claim_date").notNull(),
    trip_name: varchar("trip_name", { length: 150 }).notNull(),
    country: varchar("country", { length: 80 }),
    state: varchar("state", { length: 80 }),
    city: varchar("city", { length: 80 }),
    locality: varchar("locality", { length: 120 }),
    client_name: varchar("client_name", { length: 150 }),
    teammates: text("teammates"),
    expense_type: varchar("expense_type", { length: 15 }).notNull().default("domestic").$type<"domestic" | "international">(),
    hotel_amount: money("hotel_amount").notNull().default("0"),
    hotel_name: varchar("hotel_name", { length: 150 }),
    hotel_description: text("hotel_description"),
    breakfast: money("breakfast").notNull().default("0"),
    lunch: money("lunch").notNull().default("0"),
    dinner: money("dinner").notNull().default("0"),
    meals_description: text("meals_description"),
    local_total: money("local_total").notNull().default("0"),
    intercity_total: money("intercity_total").notNull().default("0"),
    entertainment_amount: money("entertainment_amount").notNull().default("0"),
    entertainment_description: text("entertainment_description"),
    other_amount: money("other_amount").notNull().default("0"),
    other_description: text("other_description"),
    total: money("total").notNull().default("0"),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default(sql`'[]'::jsonb`),
    status: varchar("status", { length: 10 }).notNull().default("draft").$type<(typeof CLAIM_STATUSES)[number]>(),
    submitted_at: timestamptz("submitted_at"),
    decision_note: text("decision_note"),
    approved_amount: money("approved_amount"), // can be less than claimed
    decided_by: integer("decided_by"),
    decided_at: timestamptz("decided_at"),
    paid_amount: money("paid_amount"),
    paid_on: date("paid_on"),
    payment_ref: varchar("payment_ref", { length: 80 }),
    paid_by: integer("paid_by"),
    created_at: createdAt(),
    updated_at: timestamptz("updated_at").defaultNow(),
  },
  (t) => [
    fk("expense_claims", t.company_id, companies.id, "cascade"),
    fk("expense_claims", t.employee_id, employees.id, "cascade"),
    fk("expense_claims", t.decided_by, users.id, "set null"),
    fk("expense_claims", t.paid_by, users.id, "set null"),
    index("idx_expense_claims_company").on(t.company_id, t.claim_date),
    index("idx_expense_claims_employee").on(t.employee_id, t.claim_date),
  ],
);

// Local and inter-city travel rows of a claim
export const expenseTravelLines = pgTable(
  "expense_travel_lines",
  {
    id: id(),
    claim_id: integer("claim_id").notNull(),
    kind: varchar("kind", { length: 10 }).notNull().$type<"local" | "intercity">(),
    travel_type: varchar("travel_type", { length: 12 }).notNull().$type<(typeof TRAVEL_TYPES)[number]>(),
    from_place: varchar("from_place", { length: 150 }),
    to_place: varchar("to_place", { length: 150 }),
    amount: money("amount").notNull(),
    description: text("description"),
  },
  (t) => [fk("expense_travel_lines", t.claim_id, expenseClaims.id, "cascade"), index("idx_expense_travel_claim").on(t.claim_id)],
);

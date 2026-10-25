import { index, integer, jsonb, numeric, pgTable, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";

// One subscription per company. Billed as: employee_count x price_per_employee.
// Razorpay's "quantity" on the subscription is kept in sync with the quantity
// column, so the next auto-charge always reflects the current employee count.
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    company_id: integer("company_id").notNull().unique("subscriptions_company_id_key"),
    razorpay_customer_id: varchar("razorpay_customer_id", { length: 100 }),
    razorpay_subscription_id: varchar("razorpay_subscription_id", { length: 100 }),
    razorpay_plan_id: varchar("razorpay_plan_id", { length: 100 }),
    price_per_employee: numeric("price_per_employee", { precision: 10, scale: 2 }).notNull().default("15.00"),
    quantity: integer("quantity").notNull().default(0), // employee count Razorpay is currently billing for
    status: varchar("status", { length: 20 }).notNull().default("trial"), // trial | active | past_due | cancelled
    trial_ends_at: timestamptz("trial_ends_at"),
    current_period_end: timestamptz("current_period_end"),
    created_at: createdAt(),
    updated_at: timestamptz("updated_at").defaultNow(),
  },
  (t) => [
    fk("subscriptions", t.company_id, companies.id, "cascade"),
    index("idx_subscriptions_razorpay_sub").on(t.razorpay_subscription_id),
  ],
);

// Every charge, successful or failed — feeds the "Billing history" screen.
// Populated from Razorpay webhook events, the source of truth for payment status.
export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    razorpay_payment_id: varchar("razorpay_payment_id", { length: 100 }),
    razorpay_invoice_id: varchar("razorpay_invoice_id", { length: 100 }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    employee_count: integer("employee_count").notNull(),
    status: varchar("status", { length: 20 }).notNull(), // paid | failed | pending
    billing_month: integer("billing_month"),
    billing_year: integer("billing_year"),
    created_at: createdAt(),
  },
  (t) => [
    fk("invoices", t.company_id, companies.id, "cascade"),
    index("idx_invoices_company").on(t.company_id, t.created_at.desc().nullsFirst()),
  ],
);

// Raw webhook events from Razorpay, kept for idempotency (Razorpay can
// redeliver the same event) and for debugging billing state.
export const webhookEvents = pgTable("webhook_events", {
  id: id(),
  razorpay_event_id: varchar("razorpay_event_id", { length: 150 }).unique("webhook_events_razorpay_event_id_key"),
  event_type: varchar("event_type", { length: 100 }).notNull(),
  payload: jsonb("payload").notNull(),
  processed_at: timestamptz("processed_at").defaultNow(),
});

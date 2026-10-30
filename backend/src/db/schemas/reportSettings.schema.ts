import { boolean, integer, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { fk, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";

// How a company's PDFs look (reports, payslips): letterhead, footer, watermark
export const reportSettings = pgTable(
  "report_settings",
  {
    company_id: integer("company_id").primaryKey(),
    letterhead: boolean("letterhead").notNull().default(true),
    show_logo: boolean("show_logo").notNull().default(true),
    show_address: boolean("show_address").notNull().default(true),
    show_contact: boolean("show_contact").notNull().default(true),
    show_tax_ids: boolean("show_tax_ids").notNull().default(false),
    footer_text: varchar("footer_text", { length: 200 }),
    watermark: varchar("watermark", { length: 40 }), // null = none
    signature_label: varchar("signature_label", { length: 60 }), // null = no signature line
    show_generated: boolean("show_generated").notNull().default(true),
    updated_at: timestamptz("updated_at").defaultNow(),
  },
  (t) => [fk("report_settings", t.company_id, companies.id, "cascade")],
);

export type ReportSettingsRow = typeof reportSettings.$inferSelect;

import { boolean, index, integer, jsonb, pgTable, smallint, text, varchar } from "drizzle-orm/pg-core";
import { auditColumns, auditFks } from "../auditColumns.js";
import { fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";
import { users } from "./user.schema.js";

export const LETTER_TYPES = ["offer", "appointment", "probation_confirmation", "probation_extension", "experience", "relieving", "increment", "warning", "noc", "custom"] as const;
export type LetterType = (typeof LETTER_TYPES)[number];

// A field HR fills in while making a letter (e.g. "Probation months"), used as {{key}}
export interface LetterField {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "number";
  required: boolean;
}

// The rich-text body (TipTap / ProseMirror JSON)
export type LetterDoc = { type: string; attrs?: Record<string, unknown>; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: LetterDoc[] };

// company = built from the company profile (logo, name, address) like reports; upload = own PDF / image; none = blank paper
export const LETTERHEAD_MODES = ["company", "upload", "none"] as const;
export type LetterheadMode = (typeof LETTERHEAD_MODES)[number];

// Everything needed to print a letter again exactly as it was issued
export interface LetterSnapshot {
  body: LetterDoc;
  letterhead_mode?: LetterheadMode; // older letters: upload when a path is set, else company
  letterhead_path: string | null;
  page_numbers?: boolean;
  margins: { top: number; bottom: number; left: number; right: number };
  signatory_name: string | null;
  signatory_title: string | null;
  signature_path: string | null;
  version: number;
}

// HR letter templates per company (Settings → Letter templates)
export const letterTemplates = pgTable(
  "letter_templates",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    type: varchar("type", { length: 30 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    title: varchar("title", { length: 150 }), // shown on the letter list, e.g. "Offer letter"
    letterhead_mode: varchar("letterhead_mode", { length: 10 }).$type<LetterheadMode>().notNull().default("company"),
    letterhead_path: text("letterhead_path"), // upload mode: PDF / image drawn behind every page
    letterhead_name: varchar("letterhead_name", { length: 255 }),
    // Space kept free for the letterhead's header / footer (points; 72 = 1 inch)
    margin_top: smallint("margin_top").notNull().default(120),
    margin_bottom: smallint("margin_bottom").notNull().default(90),
    margin_left: smallint("margin_left").notNull().default(60),
    margin_right: smallint("margin_right").notNull().default(60),
    body: jsonb("body").$type<LetterDoc>().notNull(),
    fields: jsonb("fields").$type<LetterField[]>().notNull().default([]),
    signatory_name: varchar("signatory_name", { length: 120 }),
    signatory_title: varchar("signatory_title", { length: 120 }),
    signature_path: text("signature_path"),
    page_numbers: boolean("page_numbers").notNull().default(true), // "Page 1 of 2" on letters longer than a page
    number_prefix: varchar("number_prefix", { length: 20 }).notNull().default("HR"),
    version: integer("version").notNull().default(1),
    is_active: boolean("is_active").notNull().default(true),
    ...auditColumns(),
  },
  (t) => [fk("letter_templates", t.company_id, companies.id, "cascade"), ...auditFks("letter_templates", t), index("idx_letter_templates_company").on(t.company_id, t.type)],
);

// A letter made for an employee: a draft, or issued with its number and PDF
export const employeeLetters = pgTable(
  "employee_letters",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    template_id: integer("template_id"),
    type: varchar("type", { length: 30 }).notNull(),
    title: varchar("title", { length: 150 }).notNull(),
    number: integer("number"), // per company, type and year
    code: varchar("code", { length: 40 }), // e.g. OFR/2026/0012
    values: jsonb("values").$type<Record<string, string>>().notNull().default({}),
    snapshot: jsonb("snapshot").$type<LetterSnapshot>().notNull(),
    status: varchar("status", { length: 10 }).notNull().default("draft"), // draft | issued
    pdf_path: text("pdf_path"),
    issued_at: timestamptz("issued_at"),
    issued_by: integer("issued_by"),
    ...auditColumns(),
  },
  (t) => [
    fk("employee_letters", t.company_id, companies.id, "cascade"),
    fk("employee_letters", t.employee_id, employees.id, "cascade"),
    fk("employee_letters", t.template_id, letterTemplates.id, "set null"),
    fk("employee_letters", t.issued_by, users.id, "set null"),
    ...auditFks("employee_letters", t),
    index("idx_employee_letters_employee").on(t.company_id, t.employee_id),
    index("idx_employee_letters_type").on(t.company_id, t.type, t.number),
  ],
);

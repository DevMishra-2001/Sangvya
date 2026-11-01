import { index, integer, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id } from "../columns.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";
import { users } from "./user.schema.js";

export const DOCUMENT_CATEGORIES = [
  "pan_card",
  "aadhaar",
  "passport",
  "photo",
  "id_proof",
  "address_proof",
  "education",
  "experience", // previous company: offer / relieving / experience letter
  "previous_payslip",
  "bank_proof", // passbook / cancelled cheque
  "offer_letter",
  "contract",
  "payslip",
  "other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

// Files kept on an employee's record (ID proof, offer letter, contract…).
export const employeeDocuments = pgTable(
  "employee_documents",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    category: varchar("category", { length: 30 }).$type<DocumentCategory>().notNull().default("other"),
    file_id: varchar("file_id", { length: 100 }).notNull(), // ImageKit fileId (to delete it)
    file_path: text("file_path").notNull(), // ImageKit path (to sign a link)
    file_name: varchar("file_name", { length: 255 }).notNull(), // original name, for the download
    mime_type: varchar("mime_type", { length: 100 }).notNull(),
    size_bytes: integer("size_bytes").notNull(),
    uploaded_by: integer("uploaded_by"),
    created_at: createdAt(),
  },
  (t) => [
    fk("employee_documents", t.company_id, companies.id, "cascade"),
    fk("employee_documents", t.employee_id, employees.id, "cascade"),
    fk("employee_documents", t.uploaded_by, users.id, "set null"),
    index("idx_employee_documents_employee").on(t.company_id, t.employee_id),
  ],
);

import { sql } from "drizzle-orm";
import { date, index, integer, numeric, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id } from "../columns.js";
import { branches } from "./branch.schema.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";
import { users } from "./user.schema.js";

export const ASSET_CATEGORIES = ["laptop", "desktop", "monitor", "mouse", "keyboard", "headset", "charger", "phone", "tablet", "sim", "id_card", "access_card", "vehicle", "furniture", "accessory", "other"] as const;
export const ASSET_STATUSES = ["available", "assigned", "in_repair", "retired", "lost"] as const;
export const ASSET_CONDITIONS = ["new", "good", "fair", "damaged"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

// The company's inventory; assigned = has an open row in asset_assignments
export const assets = pgTable(
  "assets",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    asset_code: varchar("asset_code", { length: 30 }).notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    category: varchar("category", { length: 20 }).notNull().$type<(typeof ASSET_CATEGORIES)[number]>(),
    brand: varchar("brand", { length: 80 }),
    model: varchar("model", { length: 80 }),
    serial_number: varchar("serial_number", { length: 100 }),
    purchase_date: date("purchase_date"),
    purchase_cost: numeric("purchase_cost", { precision: 12, scale: 2 }),
    warranty_until: date("warranty_until"),
    condition: varchar("condition", { length: 10 }).notNull().default("good").$type<(typeof ASSET_CONDITIONS)[number]>(),
    status: varchar("status", { length: 12 }).notNull().default("available").$type<AssetStatus>(),
    branch_id: integer("branch_id"),
    notes: text("notes"),
    created_at: createdAt(),
  },
  (t) => [
    fk("assets", t.company_id, companies.id, "cascade"),
    fk("assets", t.branch_id, branches.id, "set null"),
    uniqueIndex("idx_assets_code").on(t.company_id, sql`lower(${t.asset_code})`),
    index("idx_assets_company_status").on(t.company_id, t.status),
  ],
);

// Who had which asset, from when to when (returned_on NULL = still with them)
export const assetAssignments = pgTable(
  "asset_assignments",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    asset_id: integer("asset_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    assigned_on: date("assigned_on").notNull(),
    expected_return: date("expected_return"),
    assigned_by: integer("assigned_by"),
    assign_notes: text("assign_notes"),
    returned_on: date("returned_on"),
    return_condition: varchar("return_condition", { length: 10 }).$type<(typeof ASSET_CONDITIONS)[number]>(),
    returned_to: integer("returned_to"),
    return_notes: text("return_notes"),
    created_at: createdAt(),
  },
  (t) => [
    fk("asset_assignments", t.company_id, companies.id, "cascade"),
    fk("asset_assignments", t.asset_id, assets.id, "cascade"),
    fk("asset_assignments", t.employee_id, employees.id, "cascade"),
    fk("asset_assignments", t.assigned_by, users.id, "set null"),
    fk("asset_assignments", t.returned_to, users.id, "set null"),
    index("idx_asset_assignments_asset").on(t.asset_id),
    index("idx_asset_assignments_employee").on(t.employee_id),
    // At most one open assignment per asset
    uniqueIndex("idx_asset_assignments_open").on(t.asset_id).where(sql`${t.returned_on} IS NULL`),
  ],
);

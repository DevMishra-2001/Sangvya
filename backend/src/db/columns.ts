// Shared column builders for the Drizzle table schemas.
//
// Column keys are snake_case on purpose: rows are returned to the frontend as-is,
// and the frontend reads snake_case fields (employee_name, punch_in, …).
//
// Constraint names follow PostgreSQL's own convention (<table>_<column>_fkey, …).
import { foreignKey, integer, serial, timestamp, type PgColumn } from "drizzle-orm/pg-core";

// Auto-increment primary key
export const id = () => serial("id").primaryKey();

export const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const createdAt = () => timestamptz("created_at").defaultNow();

export function fk(table: string, column: PgColumn, references: PgColumn, onDelete: "cascade" | "set null") {
  return foreignKey({
    name: `${table}_${column.name}_fkey`,
    columns: [column],
    foreignColumns: [references],
  }).onDelete(onDelete);
}

// Standard "who added / who last changed it" columns (fill with utils/stamp.ts; FKs: auditFks in auditColumns.ts)
export const auditColumns = () => ({
  created_at: createdAt(),
  created_by: integer("created_by"),
  updated_at: timestamptz("updated_at").defaultNow(),
  updated_by: integer("updated_by"),
});

// For tables that already have created_at
export const stampColumns = () => ({
  created_by: integer("created_by"),
  updated_at: timestamptz("updated_at").defaultNow(),
  updated_by: integer("updated_by"),
});

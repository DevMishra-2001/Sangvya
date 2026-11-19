// Foreign keys for the standard audit columns (columns.ts: auditColumns / stampColumns).
//   const t = pgTable("x", { ...cols, ...auditColumns() }, (t) => [...auditFks("x", t)])
// Fill them with stamp.created(actor) / stamp.updated(actor) from utils/stamp.ts.
import type { ForeignKeyBuilder, PgColumn } from "drizzle-orm/pg-core";
import { fk } from "./columns.js";
import { users } from "./schemas/user.schema.js";

export { auditColumns, stampColumns } from "./columns.js";

export const auditFks = (table: string, t: { created_by: PgColumn; updated_by: PgColumn }): ForeignKeyBuilder[] => [
  fk(table, t.created_by, users.id, "set null"),
  fk(table, t.updated_by, users.id, "set null"),
];

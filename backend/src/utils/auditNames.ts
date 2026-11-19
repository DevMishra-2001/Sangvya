// Who added / last changed a row, by name, for list and detail queries:
//   db.select({ ...cols, ...auditNames(departments) })
import { sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export const auditNames = <T extends { created_at: PgColumn; created_by: PgColumn; updated_at: PgColumn; updated_by: PgColumn }>(t: T) => ({
  created_at: t.created_at as T["created_at"],
  updated_at: t.updated_at as T["updated_at"],
  created_by_name: sql<string | null>`(select u.name from users u where u.id = ${t.created_by})`,
  updated_by_name: sql<string | null>`(select u.name from users u where u.id = ${t.updated_by})`,
});

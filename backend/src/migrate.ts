// Applies pending database migrations (drizzle/ folder) using drizzle-orm only, so the production image
// doesn't need drizzle-kit. Run: node dist/migrate.js  (the Docker image runs it before the server starts)
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./config/db.js";

const folder = process.env.MIGRATIONS_DIR ?? "./drizzle";

try {
  await migrate(db, { migrationsFolder: folder });
  console.log("Migrations: up to date");
  await pool.end();
} catch (err) {
  const e = err as Error & { cause?: { message?: string } };
  console.error("Migration failed:", e.message.split("\n")[0], e.cause?.message ? `— ${e.cause.message}` : "");
  await pool.end().catch(() => {});
  process.exit(1);
}

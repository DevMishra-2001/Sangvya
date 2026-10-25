import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "./env.js";
import * as schema from "../db/schema.js";

const { Pool, types } = pg;

// Return DATE columns as plain "YYYY-MM-DD" strings. By default pg turns them
// into JS Dates at local midnight, which shift to the previous day once
// serialized to UTC JSON (e.g. in IST) — wrong dates on the calendar.
types.setTypeParser(types.builtins.DATE, (value) => value);

// Connection pool — reused across requests instead of opening a new
// connection every time.
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
  process.exit(-1);
});

export const db = drizzle(pool, { schema, logger: env.NODE_ENV === "development" });

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function connectDB() {
  const client = await pool.connect();
  client.release();
  console.log("PostgreSQL connected");
}

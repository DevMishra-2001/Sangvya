const { Pool, types } = require("pg");
require("dotenv").config();

// Return DATE columns as plain "YYYY-MM-DD" strings. By default pg turns them
// into JS Dates at local midnight, which shift to the previous day once
// serialized to UTC JSON (e.g. in IST) — wrong dates on the calendar.
types.setTypeParser(1082, (value) => value);

// Connection pool — reused across requests instead of opening a new
// connection every time. This is the standard pattern for pg + Express.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
  process.exit(-1);
});

// Small wrapper so every query goes through one place — makes it easy to
// add query logging or slow-query detection later.
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === "development") {
    console.log("executed query", { text, duration, rows: res.rowCount });
  }
  return res;
}

module.exports = { pool, query };

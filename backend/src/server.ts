import { app } from "./app.js";
import { connectDB, pool } from "./config/db.js";
import { env } from "./config/env.js";
import { startDayCloseJob } from "./jobs/dayClose.job.js";

async function startServer() {
  try {
    await connectDB();
  } catch (error) {
    console.error("Could not connect to PostgreSQL:", error);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`Sangvya backend running on port ${env.PORT}`);
  });

  // End-of-day attendance alerts (skipped in automated tests)
  const stopDayCloseJob = env.NODE_ENV !== "test" ? startDayCloseJob() : () => {};

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    stopDayCloseJob();
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startServer();

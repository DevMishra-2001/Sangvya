import { app } from "./app.js";
import { connectDB, pool } from "./config/db.js";
import { env } from "./config/env.js";
import { startDayCloseJob } from "./jobs/dayClose.job.js";
import { startEmployeeExitJob } from "./jobs/employeeExit.job.js";
import { startNotificationCleanupJob } from "./jobs/notificationCleanup.job.js";

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
  // Notices whose last working day has passed become exits
  const stopEmployeeExitJob = env.NODE_ENV !== "test" ? startEmployeeExitJob() : () => {};
  const stopNotificationCleanupJob = env.NODE_ENV !== "test" ? startNotificationCleanupJob() : () => {};

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    stopDayCloseJob();
    stopEmployeeExitJob();
    stopNotificationCleanupJob();
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startServer();

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

const { apiLimiter } = require("./middleware/rateLimiter");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const { startDayCloseJob } = require("./utils/dayCloseJob");

const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const recruitmentRoutes = require("./routes/recruitmentRoutes");
const performanceRoutes = require("./routes/performanceRoutes");
const billingRoutes = require("./routes/billingRoutes");
const userRoutes = require("./routes/userRoutes");
const selfRoutes = require("./routes/selfRoutes");
const holidayRoutes = require("./routes/holidayRoutes");
const taskRoutes = require("./routes/taskRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const leavePolicyRoutes = require("./routes/leavePolicyRoutes");

const app = express();

// ---- Global middleware (runs on every request, in this order) ----
app.use(helmet());                                   // secure HTTP headers
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true })); // only our frontend; allow the login cookie
app.use(cookieParser());                              // reads the HttpOnly login cookie

// The Razorpay webhook needs the exact raw request bytes to verify its
// signature, so it must NOT go through express.json() first — every other
// route gets normal JSON parsing.
app.use((req, res, next) => {
  if (req.originalUrl === "/api/billing/webhook") {
    express.raw({ type: "application/json" })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined")); // request logging
app.use("/api", apiLimiter);                          // rate limit all API routes

// ---- Health check (useful for hosting platforms / uptime monitors) ----
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ---- Feature routes (each mounts its own auth + tenant middleware) ----
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/recruitment", recruitmentRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/me", selfRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/leave-policy", leavePolicyRoutes);

// ---- 404 + centralized error handling (must be last) ----
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Sangvya backend running on port ${PORT}`);
  // End-of-day attendance alerts (skipped in automated tests)
  if (process.env.NODE_ENV !== "test") startDayCloseJob();
});

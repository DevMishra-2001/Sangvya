import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";
import { apiLimiter } from "./middlewares/rateLimiter.js";

import { adminRoutes } from "./modules/admins/admins.route.js";
import { announcementRoutes } from "./modules/announcements/announcements.route.js";
import { attendanceRoutes } from "./modules/attendance/attendance.route.js";
import { authRoutes } from "./modules/auth/auth.route.js";
import { billingRoutes } from "./modules/billing/billing.route.js";
import { companyRoutes } from "./modules/companies/companies.route.js";
import { designationRoutes } from "./modules/designations/designations.route.js";
import { employeeRoutes } from "./modules/employees/employees.route.js";
import { holidayRoutes } from "./modules/holidays/holidays.route.js";
import { leavePolicyRoutes, leaveRoutes } from "./modules/leaves/leaves.route.js";
import { pageRoutes } from "./modules/pages/pages.route.js";
import { platformCompanyRoutes } from "./modules/platform/platformCompanies.route.js";
import { platformAuditRoutes, platformOverviewRoutes } from "./modules/platform/platform.route.js";
import { payrollRoutes } from "./modules/payroll/payroll.route.js";
import { performanceRoutes } from "./modules/performance/performance.route.js";
import { roleRoutes } from "./modules/roles/roles.route.js";
import { recruitmentRoutes } from "./modules/recruitment/recruitment.route.js";
import { selfRoutes } from "./modules/self/self.route.js";
import { settingsRoutes } from "./modules/settings/settings.route.js";
import { taskRoutes } from "./modules/tasks/tasks.route.js";
import { uploadRoutes } from "./modules/upload/upload.route.js";
import { userRoutes } from "./modules/users/users.route.js";

export const app = express();

// Behind the Next.js frontend (or a hosting proxy), req.ip comes from X-Forwarded-For
app.set("trust proxy", env.TRUST_PROXY);

// ---- Global middleware (runs on every request, in this order) ----
app.use(helmet()); // secure HTTP headers
app.use(cors({ origin: env.FRONTEND_URL, credentials: true })); // only our frontend; allow the login cookie
app.use(cookieParser()); // reads the HttpOnly login cookies

// JSON bodies everywhere except the Razorpay webhook, which needs the raw bytes
// to verify its signature (it parses its own body in billing.route.ts).
const json = express.json();
app.use((req, res, next) => (req.originalUrl === "/api/billing/webhook" ? next() : json(req, res, next)));

app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined")); // request logging
app.use("/api", apiLimiter); // rate limit all API routes

// ---- Health check (hosting platforms / uptime monitors) ----
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ---- Feature modules (each route file mounts its own auth + tenant middleware) ----
app.use("/api/auth", authRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/designations", designationRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/leave-policy", leavePolicyRoutes);
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
app.use("/api/upload", uploadRoutes);
app.use("/api/pages", pageRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/platform/companies", platformCompanyRoutes);
app.use("/api/platform/audit", platformAuditRoutes);
app.use("/api/platform/overview", platformOverviewRoutes);

// ---- 404 + centralized error handling (must be last) ----
app.use(notFound);
app.use(errorHandler);

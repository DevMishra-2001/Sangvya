import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { auditQuery, type AuditQuery } from "./platform.schema.js";
import { currentUser } from "../../utils/requestContext.js";
import { exportAudit, listAudit } from "./platformAudit.service.js";
import { broadcastHistory, broadcastSchema, sendBroadcast } from "./platformBroadcast.service.js";
import { platformHealth } from "./platformHealth.service.js";
import { platformInsights } from "./platformInsights.service.js";
import { getPlatformSettings, savePlatformSettings, settingsSchema } from "./platformSettings.service.js";
import { platformOverview } from "./platformOverview.service.js";

// GET /api/platform/audit?action=&companyId=&q=&before=&limit=
const audit = Router();
audit.use(authenticate, requirePermission("platform.audit"));
audit.get(
  "/",
  validate({ query: auditQuery }),
  asyncHandler(async (req, res) => {
    res.json(await listAudit(req.query as unknown as AuditQuery));
  }),
);

// GET /api/platform/audit/export?… → Excel with the same filters
audit.get(
  "/export",
  validate({ query: auditQuery }),
  asyncHandler(async (req, res) => {
    const body = await exportAudit(req.query as unknown as AuditQuery);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="audit-log.xlsx"');
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
  }),
);

// GET /api/platform/overview
const overview = Router();
overview.use(authenticate, requirePermission("platform.overview"));
overview.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await platformOverview());
  }),
);

// GET / PUT /api/platform/settings
const settings = Router();
settings.use(authenticate, requirePermission("platform.settings"));
settings.get("/", asyncHandler(async (_req, res) => res.json(await getPlatformSettings())));
settings.put("/", validate({ body: settingsSchema }), asyncHandler(async (req, res) => res.json(await savePlatformSettings(currentUser(req), req.body))));

// GET /api/platform/insights — revenue + usage
const insights = Router();
insights.use(authenticate, requirePermission("platform.insights"));
insights.get("/", asyncHandler(async (_req, res) => res.json(await platformInsights())));

// GET /api/platform/health — jobs, email, database, server
const health = Router();
health.use(authenticate, requirePermission("platform.health"));
health.get("/", asyncHandler(async (_req, res) => res.json(await platformHealth())));

// POST /api/platform/broadcast { …, dryRun } and GET history
const broadcast = Router();
broadcast.use(authenticate, requirePermission("platform.broadcast"));
broadcast.get("/", asyncHandler(async (_req, res) => res.json({ history: await broadcastHistory() })));
broadcast.post("/", validate({ body: broadcastSchema }), asyncHandler(async (req, res) => res.json(await sendBroadcast(currentUser(req), req.body))));

export const platformSettingsRoutes = settings;
export const platformInsightsRoutes = insights;
export const platformHealthRoutes = health;
export const platformBroadcastRoutes = broadcast;
export const platformAuditRoutes = audit;
export const platformOverviewRoutes = overview;

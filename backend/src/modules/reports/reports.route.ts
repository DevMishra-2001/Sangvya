import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../config/db.js";
import { users } from "../../db/schema.js";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { getReportSettings, loadBrand, updateReportSettings } from "./branding.js";
import { toPdf } from "./exporters/pdf.js";
import { REPORTS } from "./registry.js";
import { reportSettingsSchema } from "./reports.schema.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { audit } from "../../utils/audit.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { catalog, EXPORT_FORMATS, exportReport, reportMeta, runReport, type ExportFormat } from "./reports.service.js";

const keyParams = z.object({ key: z.string().regex(/^[a-z0-9-]{1,60}$/, "Invalid report") });
const exportQuery = z.object({ format: z.enum(Object.keys(EXPORT_FORMATS) as [ExportFormat, ...ExportFormat[]]) }).passthrough();

// Each report checks its own permission (see registry.ts)
const router = Router();
router.use(authenticate, scopeToCompany);

router.get("/", (req, res) => {
  res.json(catalog(currentUser(req)));
});

// ---- How the PDFs look (Admin) ----
const settings = requirePermission("reports.settings");
router.get(
  "/settings",
  settings,
  asyncHandler(async (req, res) => {
    res.json({ settings: await getReportSettings(tenant(req).companyId) });
  }),
);
router.put(
  "/settings",
  settings,
  validate({ body: reportSettingsSchema }),
  asyncHandler(async (req, res) => {
    res.json(await updateReportSettings(tenant(req).companyId, currentUser(req), req.body));
  }),
);
// A sample PDF with the saved settings (the employee master, main columns)
router.get(
  "/settings/preview",
  settings,
  asyncHandler(async (req, res) => {
    const { companyId } = tenant(req);
    const sample = REPORTS.find((r) => r.key === "employee-master")!;
    const result = await sample.build(companyId, { status: "current" });
    const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, currentUser(req).id));
    const pdf = await toPdf({ ...result, columns: result.columns.filter((c) => !c.exportOnly) }, await loadBrand(companyId), me?.name);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="report-preview.pdf"');
    res.setHeader("Cache-Control", "no-store");
    res.send(pdf);
  }),
);

router.get(
  "/:key/meta",
  validate({ params: keyParams }),
  asyncHandler(async (req, res) => {
    res.json(await reportMeta(tenant(req).companyId, currentUser(req), req.params.key));
  }),
);

router.get(
  "/:key",
  validate({ params: keyParams }),
  asyncHandler(async (req, res) => {
    res.json(await runReport(tenant(req).companyId, currentUser(req), req.params.key, req.query as Record<string, unknown>));
  }),
);

router.get(
  "/:key/export",
  validate({ params: keyParams, query: exportQuery }),
  asyncHandler(async (req, res) => {
    const { format, ...filters } = req.query as { format: ExportFormat } & Record<string, unknown>;
    const { companyId } = tenant(req);
    const file = await exportReport(companyId, currentUser(req), req.params.key, format, filters);
    audit(currentUser(req), { companyId, action: "report.exported", summary: `Exported ${file.fileName}` });
    res.setHeader("Content-Type", file.type);
    res.setHeader("Content-Disposition", `${file.inline ? "inline" : "attachment"}; filename="${file.fileName}"`);
    res.setHeader("Content-Length", String(file.body.length));
    res.setHeader("Cache-Control", "no-store");
    res.send(file.body);
  }),
);

export const reportRoutes = router;

// Developer preview of every email template with sample data — not in production, Super Admin only.
import { Router } from "express";
import { env } from "../../config/env.js";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { NotFoundError } from "../../utils/httpErrors.js";
import { renderTemplate, TEMPLATES, type TemplateName } from "./templates.js";

const router = Router();
router.use((_req, _res, next) => (env.NODE_ENV === "production" ? next(new NotFoundError("Not found")) : next()));
router.use(authenticate, requirePermission("platform.overview"));

router.get("/", (_req, res) => {
  res.json({ templates: Object.keys(TEMPLATES).map((name) => ({ name, preview: `/api/dev/mail/${name}` })) });
});

router.get(
  "/:name",
  asyncHandler(async (req, res) => {
    const name = req.params.name as TemplateName;
    if (!(name in TEMPLATES)) throw new NotFoundError("No such template");
    const out = renderTemplate(name, TEMPLATES[name].sample as never);
    if (req.query.format === "text") res.type("text/plain").send(`Subject: ${out.subject}\n\n${out.text}`);
    else res.type("html").send(out.html);
  }),
);

export const mailPreviewRoutes = router;

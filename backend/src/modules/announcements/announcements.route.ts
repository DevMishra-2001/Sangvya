import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import { createAnnouncementHandler, deleteAnnouncementHandler, feedHandler } from "./announcements.controller.js";
import { createAnnouncementSchema } from "./announcements.schema.js";

const router = Router();
router.use(authenticate, scopeToCompany);

router.get("/feed", feedHandler);
router.post("/", requirePermission("announcements.manage"), validate({ body: createAnnouncementSchema }), createAnnouncementHandler);
router.delete("/:id", requirePermission("announcements.manage"), validate({ params: idParams }), deleteAnnouncementHandler);

export const announcementRoutes = router;

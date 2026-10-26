import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import { createAdminHandler, deleteAdminHandler, listAdminsHandler } from "./admins.controller.js";
import { createAdminSchema } from "./admins.schema.js";

// Platform-wide (no company scope); Super Admin only via the Admins page
const router = Router();
router.use(authenticate, requirePermission("admins.manage"));

router.get("/", listAdminsHandler);
router.post("/", validate({ body: createAdminSchema }), createAdminHandler);
router.delete("/:id", validate({ params: idParams }), deleteAdminHandler);

export const adminRoutes = router;

import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import { deleteAdminHandler, inviteAdminHandler, listAdminsHandler, resendInviteHandler } from "./admins.controller.js";
import { inviteAdminSchema } from "./admins.schema.js";

// Platform-wide (no company scope); Super Admin only via the Admins page
const router = Router();
router.use(authenticate, requirePermission("admins.manage"));

router.get("/", listAdminsHandler);
router.post("/", validate({ body: inviteAdminSchema }), inviteAdminHandler);
router.post("/:id/resend", validate({ params: idParams }), resendInviteHandler);
router.delete("/:id", validate({ params: idParams }), deleteAdminHandler);

export const adminRoutes = router;

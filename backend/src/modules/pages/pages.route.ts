import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import { createPageHandler, deletePageHandler, listPagesHandler, updatePageHandler } from "./pages.controller.js";
import { pageSchema } from "./pages.schema.js";

// Page Master — platform-wide, so no company scope; Super Admin only (pages.manage)
const router = Router();
router.use(authenticate, requirePermission("pages.manage"));

router.get("/", listPagesHandler);
router.post("/", validate({ body: pageSchema }), createPageHandler);
router.put("/:id", validate({ params: idParams, body: pageSchema }), updatePageHandler);
router.delete("/:id", validate({ params: idParams }), deletePageHandler);

export const pageRoutes = router;

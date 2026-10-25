import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import {
  createDesignationHandler,
  defaultDesignationsHandler,
  deleteDesignationHandler,
  listDesignationsHandler,
  renameDesignationHandler,
} from "./designations.controller.js";
import { designationSchema } from "./designations.schema.js";

const router = Router();
router.use(authenticate);

router.get("/defaults", defaultDesignationsHandler);

router.use(scopeToCompany);
router.get("/", listDesignationsHandler);
router.post("/", requirePermission("employees.manage"), validate({ body: designationSchema }), createDesignationHandler);
router.patch("/:id", requirePermission("employees.manage"), validate({ params: idParams, body: designationSchema }), renameDesignationHandler);
router.delete("/:id", requirePermission("employees.manage"), validate({ params: idParams }), deleteDesignationHandler);

export const designationRoutes = router;

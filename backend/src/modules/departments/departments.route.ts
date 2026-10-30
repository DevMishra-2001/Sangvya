import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import { createDepartmentHandler, deleteDepartmentHandler, listDepartmentsHandler, updateDepartmentHandler } from "./departments.controller.js";
import { departmentSchema } from "./departments.schema.js";

// A company's departments: everyone can read them (profiles, filters); Admin/HR manage them
const router = Router();
router.use(authenticate, scopeToCompany);

router.get("/", listDepartmentsHandler);
router.post("/", requirePermission("departments.manage"), validate({ body: departmentSchema }), createDepartmentHandler);
router.put("/:id", requirePermission("departments.manage"), validate({ params: idParams, body: departmentSchema }), updateDepartmentHandler);
router.delete("/:id", requirePermission("departments.manage"), validate({ params: idParams }), deleteDepartmentHandler);

export const departmentRoutes = router;

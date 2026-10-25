import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import {
  createEmployeeHandler,
  deleteEmployeeHandler,
  listEmployeesHandler,
  updateEmployeeHandler,
} from "./employees.controller.js";
import { employeeSchema } from "./employees.schema.js";

const router = Router();

// Every route below runs: authenticate -> scopeToCompany -> permission -> validate -> controller
router.use(authenticate, scopeToCompany);

router.get("/", requirePermission("employees.view"), listEmployeesHandler);
router.post("/", requirePermission("employees.manage"), validate({ body: employeeSchema }), createEmployeeHandler);
router.put("/:id", requirePermission("employees.manage"), validate({ params: idParams, body: employeeSchema }), updateEmployeeHandler);
router.delete("/:id", requirePermission("employees.manage"), validate({ params: idParams }), deleteEmployeeHandler);

export const employeeRoutes = router;

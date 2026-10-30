import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { idParams } from "../../utils/zod.js";
import { createShift, deleteShift, listShifts, updateShift } from "./shifts.service.js";
import { shiftSchema } from "./shifts.schema.js";

// Shifts: readable for the employee form; Admin / HR manage them
const router = Router();
router.use(authenticate, scopeToCompany);

router.get(
  "/",
  requirePermission("employees.view"),
  asyncHandler(async (req, res) => {
    res.json(await listShifts(tenant(req).companyId));
  }),
);
router.post(
  "/",
  requirePermission("shifts.manage"),
  validate({ body: shiftSchema }),
  asyncHandler(async (req, res) => {
    res.status(HttpStatus.CREATED).json(await createShift(tenant(req).companyId, currentUser(req), req.body));
  }),
);
router.put(
  "/:id",
  requirePermission("shifts.manage"),
  validate({ params: idParams, body: shiftSchema }),
  asyncHandler(async (req, res) => {
    res.json(await updateShift(tenant(req).companyId, currentUser(req), Number(req.params.id), req.body));
  }),
);
router.delete(
  "/:id",
  requirePermission("shifts.manage"),
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await deleteShift(tenant(req).companyId, currentUser(req), Number(req.params.id));
    res.json({ success: true });
  }),
);

export const shiftRoutes = router;

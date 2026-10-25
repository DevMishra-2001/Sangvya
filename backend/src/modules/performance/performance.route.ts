import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import {
  createCycleHandler,
  cycleReviewsHandler,
  employeeReviewsHandler,
  listCyclesHandler,
  updateCycleStatusHandler,
  updateReviewStatusHandler,
  upsertReviewHandler,
} from "./performance.controller.js";
import {
  createCycleSchema,
  cycleIdParams,
  cycleStatusSchema,
  employeeIdParams,
  reviewSchema,
  reviewStatusSchema,
} from "./performance.schema.js";

const router = Router();
router.use(authenticate, scopeToCompany);

// ---- Review cycles ----
router.get("/cycles", requirePermission("performance.view"), listCyclesHandler);
router.post("/cycles", requirePermission("performance.manageCycles"), validate({ body: createCycleSchema }), createCycleHandler);
router.patch(
  "/cycles/:id/status",
  requirePermission("performance.manageCycles"),
  validate({ params: idParams, body: cycleStatusSchema }),
  updateCycleStatusHandler,
);

// ---- Reviews ----
router.get("/cycles/:cycleId/reviews", requirePermission("performance.view"), validate({ params: cycleIdParams }), cycleReviewsHandler);
router.get(
  "/employees/:employeeId/reviews",
  requirePermission("performance.view"),
  validate({ params: employeeIdParams }),
  employeeReviewsHandler,
);
router.post("/reviews", requirePermission("performance.review"), validate({ body: reviewSchema }), upsertReviewHandler);
router.patch(
  "/reviews/:id/status",
  requirePermission("performance.review"),
  validate({ params: idParams, body: reviewStatusSchema }),
  updateReviewStatusHandler,
);

export const performanceRoutes = router;

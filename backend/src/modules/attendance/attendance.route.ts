import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { idParams } from "../../utils/zod.js";
import { attendanceByDateHandler, employeeAttendanceHandler, markAttendanceHandler } from "./attendance.controller.js";
import { decideCorrection, listCorrections } from "./corrections.service.js";
import {
  attendanceByDateQuery,
  employeeAttendanceParams,
  employeeAttendanceQuery,
  correctionDecisionSchema,
  correctionListQuery,
  markAttendanceSchema,
} from "./attendance.schema.js";

const router = Router();
router.use(authenticate, scopeToCompany);

router.get("/", requirePermission("attendance.view"), validate({ query: attendanceByDateQuery }), attendanceByDateHandler);
router.post("/", requirePermission("attendance.mark"), validate({ body: markAttendanceSchema }), markAttendanceHandler);
router.get(
  "/employee/:employeeId",
  requirePermission("attendance.view"),
  validate({ params: employeeAttendanceParams, query: employeeAttendanceQuery }),
  employeeAttendanceHandler,
);

// ---- Corrections: HR sees all; a manager their team's (decided per request) ----
router.get(
  "/corrections",
  requirePermission("attendance.self"),
  validate({ query: correctionListQuery }),
  asyncHandler(async (req, res) => {
    res.json(await listCorrections(tenant(req).companyId, currentUser(req), (req.query as { status: "pending" | "approved" | "rejected" | "all" }).status));
  }),
);
router.patch(
  "/corrections/:id",
  requirePermission("attendance.self"),
  validate({ params: idParams, body: correctionDecisionSchema }),
  asyncHandler(async (req, res) => {
    res.json(await decideCorrection(tenant(req).companyId, currentUser(req), Number(req.params.id), req.body));
  }),
);

export const attendanceRoutes = router;

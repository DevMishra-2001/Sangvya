import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { attendanceByDateHandler, employeeAttendanceHandler, markAttendanceHandler } from "./attendance.controller.js";
import {
  attendanceByDateQuery,
  employeeAttendanceParams,
  employeeAttendanceQuery,
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

export const attendanceRoutes = router;

import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { myTeam } from "./team.service.js";
import { myPayslips } from "../payroll/payroll.service.js";
import { payslipPdfHandler } from "../payroll/payroll.controller.js";
import { cancelCorrection, myCorrections, requestCorrection } from "../attendance/corrections.service.js";
import { correctionSchema } from "../attendance/attendance.schema.js";
import { idParams } from "../../utils/zod.js";
import { authenticate, requireEmployeeLink, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import {
  attendanceDayHandler,
  breakEndHandler,
  breakStartHandler,
  calendarHandler,
  leaveBalanceHandler,
  myLeavesHandler,
  punchInHandler,
  profileHandler,
  punchOutHandler,
  todayHandler,
  updatePhotoHandler,
} from "./self.controller.js";
import { dateQuery, monthQuery, photoSchema, punchSchema } from "./self.schema.js";

const router = Router();

// Everything here acts on the logged-in user's own employee record.
// Attendance / leave routes need their module's permission (switched off per company).
router.use(authenticate, scopeToCompany, requireEmployeeLink);
const attendance = requirePermission("attendance.self");
const leave = requirePermission("leave.apply");

router.get("/profile", profileHandler);
// My team: people who report to me (empty if nobody does)
router.get(
  "/team",
  asyncHandler(async (req, res) => {
    const { companyId } = tenant(req);
    res.json(await myTeam(companyId, currentUser(req).employeeId!));
  }),
);
router.put("/photo", validate({ body: photoSchema }), updatePhotoHandler);
router.get("/today", attendance, todayHandler);
router.post("/punch-in", attendance, validate({ body: punchSchema }), punchInHandler);
router.post("/break-start", attendance, breakStartHandler);
router.post("/break-end", attendance, breakEndHandler);
router.post("/punch-out", attendance, validate({ body: punchSchema }), punchOutHandler);
router.get("/calendar", attendance, validate({ query: monthQuery }), calendarHandler);
// My finalized payslips
router.get(
  "/payslips",
  requirePermission("payroll.self"),
  asyncHandler(async (req, res) => {
    res.json(await myPayslips(tenant(req).companyId, currentUser(req).employeeId!));
  }),
);
router.get("/payslips/:id/pdf", requirePermission("payroll.self"), validate({ params: idParams }), payslipPdfHandler);
// Attendance corrections: ask to fix a past day (my manager decides)
router.get(
  "/corrections",
  attendance,
  asyncHandler(async (req, res) => {
    res.json(await myCorrections(tenant(req).companyId, currentUser(req)));
  }),
);
router.post(
  "/corrections",
  attendance,
  validate({ body: correctionSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await requestCorrection(tenant(req).companyId, currentUser(req), req.body));
  }),
);
router.delete(
  "/corrections/:id",
  attendance,
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await cancelCorrection(tenant(req).companyId, currentUser(req), Number(req.params.id));
    res.json({ success: true });
  }),
);
router.get("/attendance", attendance, validate({ query: dateQuery }), attendanceDayHandler);
router.get("/leave-balance", leave, leaveBalanceHandler);
router.get("/leaves", leave, validate({ query: monthQuery }), myLeavesHandler);

export const selfRoutes = router;

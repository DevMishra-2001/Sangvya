import { Router } from "express";
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
router.put("/photo", validate({ body: photoSchema }), updatePhotoHandler);
router.get("/today", attendance, todayHandler);
router.post("/punch-in", attendance, validate({ body: punchSchema }), punchInHandler);
router.post("/break-start", attendance, breakStartHandler);
router.post("/break-end", attendance, breakEndHandler);
router.post("/punch-out", attendance, validate({ body: punchSchema }), punchOutHandler);
router.get("/calendar", attendance, validate({ query: monthQuery }), calendarHandler);
router.get("/attendance", attendance, validate({ query: dateQuery }), attendanceDayHandler);
router.get("/leave-balance", leave, leaveBalanceHandler);
router.get("/leaves", leave, validate({ query: monthQuery }), myLeavesHandler);

export const selfRoutes = router;

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

// Everything here acts on the logged-in user's own employee record
router.use(authenticate, scopeToCompany, requirePermission("attendance.self"), requireEmployeeLink);

router.get("/profile", profileHandler);
router.put("/photo", validate({ body: photoSchema }), updatePhotoHandler);
router.get("/today", todayHandler);
router.post("/punch-in", validate({ body: punchSchema }), punchInHandler);
router.post("/break-start", breakStartHandler);
router.post("/break-end", breakEndHandler);
router.post("/punch-out", validate({ body: punchSchema }), punchOutHandler);
router.get("/calendar", validate({ query: monthQuery }), calendarHandler);
router.get("/attendance", validate({ query: dateQuery }), attendanceDayHandler);
router.get("/leave-balance", leaveBalanceHandler);
router.get("/leaves", validate({ query: monthQuery }), myLeavesHandler);

export const selfRoutes = router;

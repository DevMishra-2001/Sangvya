const express = require("express");
const { authenticate, requirePermission } = require("../middleware/auth");
const { scopeToCompany } = require("../middleware/tenant");
const asyncHandler = require("../utils/asyncHandler");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { LOCATIONS } = require("../utils/attendanceStatus");
const selfAttendanceController = require("../controllers/selfAttendanceController");

const router = express.Router();
router.use(authenticate, scopeToCompany, requirePermission("attendance.self"));

// Everything here acts on the logged-in user's own employee record.
router.use((req, res, next) => {
  if (!req.user.employeeId) {
    return res.status(400).json({ error: "Your login isn't linked to an employee record — ask HR to link it" });
  }
  next();
});

router.get("/today", asyncHandler(selfAttendanceController.today));
// Optional location + remarks on check-in / check-out
const punchBody = [
  body("location").optional({ values: "falsy" }).isIn(LOCATIONS).withMessage(`Location must be one of: ${LOCATIONS.join(", ")}`),
  body("remarks").optional({ values: "falsy" }).isString().isLength({ max: 300 }).withMessage("Remarks can be at most 300 characters"),
];

router.post("/punch-in", punchBody, validate, asyncHandler(selfAttendanceController.punchIn));
router.post("/break-start", asyncHandler(selfAttendanceController.breakStart));
router.post("/break-end", asyncHandler(selfAttendanceController.breakEnd));
router.post("/punch-out", punchBody, validate, asyncHandler(selfAttendanceController.punchOut));
router.get("/calendar", asyncHandler(selfAttendanceController.calendar)); // ?month=YYYY-MM
router.get("/attendance", asyncHandler(selfAttendanceController.attendanceDay)); // ?date=YYYY-MM-DD
router.get("/leave-balance", asyncHandler(selfAttendanceController.leaveBalance));
router.get("/leaves", asyncHandler(selfAttendanceController.myLeaves)); // ?month=YYYY-MM

module.exports = router;

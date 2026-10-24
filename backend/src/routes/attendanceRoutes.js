const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, requirePermission } = require("../middleware/auth");
const { scopeToCompany } = require("../middleware/tenant");
const asyncHandler = require("../utils/asyncHandler");
const attendanceController = require("../controllers/attendanceController");

const router = express.Router();
router.use(authenticate, scopeToCompany);

router.get("/", requirePermission("attendance.view"), asyncHandler(attendanceController.byDate)); // ?date=YYYY-MM-DD

router.post(
  "/",
  requirePermission("attendance.mark"),
  [
    body("employeeId").isUUID().withMessage("Valid employeeId is required"),
    body("date").isISO8601().withMessage("Valid date is required"),
    body("status").isIn(["present", "absent", "half"]).withMessage("Status must be present, absent, or half"),
  ],
  validate,
  asyncHandler(attendanceController.mark)
);

router.get("/employee/:employeeId", requirePermission("attendance.view"), asyncHandler(attendanceController.byEmployee)); // ?from=&to=

module.exports = router;

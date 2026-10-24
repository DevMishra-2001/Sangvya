const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, requirePermission } = require("../middleware/auth");
const { scopeToCompany } = require("../middleware/tenant");
const asyncHandler = require("../utils/asyncHandler");
const leaveController = require("../controllers/leaveController");
const { LEAVE_TYPES } = leaveController;

const router = express.Router();
router.use(authenticate, scopeToCompany);

// Everyone can list — the controller narrows it to own leaves without "leave.viewAll"
router.get("/", asyncHandler(leaveController.list));

router.post(
  "/",
  requirePermission("leave.apply"),
  [
    body("employeeId").optional({ values: "falsy" }).isUUID().withMessage("Invalid employeeId"),
    body("fromDate").isISO8601().withMessage("Valid fromDate is required"),
    body("toDate").isISO8601().withMessage("Valid toDate is required"),
    body("leaveType").optional().isIn(LEAVE_TYPES).withMessage(`leaveType must be one of: ${LEAVE_TYPES.join(", ")}`),
  ],
  validate,
  asyncHandler(leaveController.create)
);

router.patch("/:id/status", requirePermission("leave.approve"), asyncHandler(leaveController.updateStatus));

module.exports = router;

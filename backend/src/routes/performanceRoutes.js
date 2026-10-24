const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, requirePermission } = require("../middleware/auth");
const { scopeToCompany } = require("../middleware/tenant");
const asyncHandler = require("../utils/asyncHandler");
const cycleController = require("../controllers/cycleController");
const reviewController = require("../controllers/reviewController");

const router = express.Router();
router.use(authenticate, scopeToCompany);

// ---- Review cycles ----
router.get("/cycles", requirePermission("performance.view"), asyncHandler(cycleController.list));

router.post(
  "/cycles",
  requirePermission("performance.manageCycles"),
  [
    body("name").trim().notEmpty().withMessage("Cycle name is required"),
    body("startDate").isISO8601().withMessage("Valid startDate is required"),
    body("endDate").isISO8601().withMessage("Valid endDate is required"),
  ],
  validate,
  asyncHandler(cycleController.create)
);

router.patch("/cycles/:id/status", requirePermission("performance.manageCycles"), asyncHandler(cycleController.updateStatus));

// ---- Reviews ----
router.get("/cycles/:cycleId/reviews", requirePermission("performance.view"), asyncHandler(reviewController.listByCycle));
router.get("/employees/:employeeId/reviews", requirePermission("performance.view"), asyncHandler(reviewController.listByEmployee));

router.post(
  "/reviews",
  requirePermission("performance.review"),
  [
    body("cycleId").isUUID().withMessage("Valid cycleId is required"),
    body("employeeId").isUUID().withMessage("Valid employeeId is required"),
    body("rating").optional({ nullable: true }).isInt({ min: 1, max: 5 }).withMessage("Rating must be 1-5"),
  ],
  validate,
  asyncHandler(reviewController.upsert)
);

router.patch("/reviews/:id/status", requirePermission("performance.review"), asyncHandler(reviewController.updateStatus));

module.exports = router;

const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, requirePermission } = require("../middleware/auth");
const { scopeToCompany } = require("../middleware/tenant");
const asyncHandler = require("../utils/asyncHandler");
const taskController = require("../controllers/taskController");

const router = express.Router();
router.use(authenticate, scopeToCompany);

// Anyone: their own tasks + updating them
router.get("/mine", asyncHandler(taskController.mine));
router.patch(
  "/:id/progress",
  [body("progress").optional().isInt({ min: 0, max: 100 }).withMessage("Progress must be 0-100")],
  validate,
  asyncHandler(taskController.updateProgress)
);

// Assigners
router.get("/assigned", requirePermission("tasks.assign"), asyncHandler(taskController.assigned));
router.get("/assignable", requirePermission("tasks.assign"), asyncHandler(taskController.assignable));
router.post(
  "/",
  requirePermission("tasks.assign"),
  [
    body("title").trim().notEmpty().withMessage("Task title is required"),
    body("assignedTo").isUUID().withMessage("Choose who the task is for"),
    body("priority").optional().isIn(taskController.PRIORITIES).withMessage("Priority must be low, medium or high"),
    body("dueDate").optional({ values: "falsy" }).isISO8601().withMessage("Invalid due date"),
  ],
  validate,
  asyncHandler(taskController.create)
);
router.patch("/:id/review", requirePermission("tasks.assign"), asyncHandler(taskController.review));
router.delete("/:id", requirePermission("tasks.assign"), asyncHandler(taskController.remove));

module.exports = router;

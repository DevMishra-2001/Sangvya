const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, requirePermission } = require("../middleware/auth");
const { scopeToCompany } = require("../middleware/tenant");
const asyncHandler = require("../utils/asyncHandler");
const employeeController = require("../controllers/employeeController");

const router = express.Router();

// Every route below runs: authenticate -> scopeToCompany -> validate -> controller
router.use(authenticate, scopeToCompany);

router.get("/", requirePermission("employees.view"), asyncHandler(employeeController.list));

router.post(
  "/",
  requirePermission("employees.manage"),
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("employeeCode").optional({ values: "null" }).isString().trim().isLength({ max: 40 }).withMessage("Employee code can be at most 40 characters"),
    body("olQuota").optional({ values: "null" }).custom((v) => v === "" || (Number(v) >= 0 && Number(v) <= 365)).withMessage("Optional leaves per year must be a number from 0 to 365"),
  ],
  validate,
  asyncHandler(employeeController.create)
);

router.put(
  "/:id",
  requirePermission("employees.manage"),
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("employeeCode").optional({ values: "null" }).isString().trim().isLength({ max: 40 }).withMessage("Employee code can be at most 40 characters"),
    body("olQuota").optional({ values: "null" }).custom((v) => v === "" || (Number(v) >= 0 && Number(v) <= 365)).withMessage("Optional leaves per year must be a number from 0 to 365"),
  ],
  validate,
  asyncHandler(employeeController.update)
);

router.delete("/:id", requirePermission("employees.manage"), asyncHandler(employeeController.remove));

module.exports = router;

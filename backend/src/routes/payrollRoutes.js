const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, requirePermission } = require("../middleware/auth");
const { scopeToCompany } = require("../middleware/tenant");
const asyncHandler = require("../utils/asyncHandler");
const payrollController = require("../controllers/payrollController");

const router = express.Router();
router.use(authenticate, scopeToCompany);

router.get("/salary-structure", requirePermission("payroll.view"), asyncHandler(payrollController.listSalaryStructures));

router.post(
  "/salary-structure",
  requirePermission("payroll.manage"),
  [
    body("employeeId").isUUID().withMessage("Valid employeeId is required"),
    body("basic").isFloat({ min: 0 }).withMessage("Basic must be a positive number"),
  ],
  validate,
  asyncHandler(payrollController.setSalaryStructure)
);

router.post(
  "/run",
  requirePermission("payroll.manage"),
  [
    body("month").isInt({ min: 1, max: 12 }).withMessage("Month must be 1-12"),
    body("year").isInt({ min: 2000 }).withMessage("Valid year is required"),
  ],
  validate,
  asyncHandler(payrollController.runPayroll)
);

router.get("/runs", requirePermission("payroll.view"), asyncHandler(payrollController.listRuns));
router.get("/runs/:runId/payslips", requirePermission("payroll.view"), asyncHandler(payrollController.listPayslipsForRun));
router.get("/payslips/:id/pdf", requirePermission("payroll.view"), asyncHandler(payrollController.downloadPayslipPDF));

module.exports = router;

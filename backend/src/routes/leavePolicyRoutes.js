const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, requirePermission } = require("../middleware/auth");
const { scopeToCompany } = require("../middleware/tenant");
const asyncHandler = require("../utils/asyncHandler");
const { getPolicy, updatePolicy } = require("../utils/leaveBalance");

const router = express.Router();
router.use(authenticate, scopeToCompany);

// GET /api/leave-policy — the company's CL / SL / OL / EL quotas (anyone can read)
router.get("/", asyncHandler(async (req, res) => {
  res.json({ policy: await getPolicy(req.companyId) });
}));

const quota = (field, label, max) =>
  body(field).isFloat({ min: 0, max }).withMessage(`${label} must be a number from 0 to ${max}`).toFloat();

// PUT /api/leave-policy { clPerYear, slPerYear, olPerYear, elPerMonth }
router.put(
  "/",
  requirePermission("leavePolicy.manage"),
  [
    quota("clPerYear", "CL per year", 365),
    quota("slPerYear", "SL per year", 365),
    quota("olPerYear", "OL per year", 365),
    quota("elPerMonth", "EL per month", 31),
  ],
  validate,
  asyncHandler(async (req, res) => {
    res.json({ policy: await updatePolicy(req.companyId, req.body) });
  })
);

module.exports = router;

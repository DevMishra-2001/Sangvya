const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, requirePermission } = require("../middleware/auth");
const { scopeToCompany } = require("../middleware/tenant");
const asyncHandler = require("../utils/asyncHandler");
const HolidayModel = require("../models/holidayModel");

const router = express.Router();
router.use(authenticate, scopeToCompany);

// Every logged-in user can see the holiday list
router.get("/", asyncHandler(async (req, res) => {
  res.json({ holidays: await HolidayModel.findAll(req.companyId) });
}));

router.post(
  "/",
  requirePermission("holidays.manage"),
  [
    body("date").isISO8601().withMessage("Valid date is required"),
    body("name").trim().notEmpty().withMessage("Holiday name is required"),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { date, name } = req.body;
    if (await HolidayModel.findByDate(req.companyId, date)) {
      return res.status(409).json({ error: "There's already a holiday on this date" });
    }
    res.status(201).json({ holiday: await HolidayModel.create(req.companyId, { date, name }) });
  })
);

router.delete("/:id", requirePermission("holidays.manage"), asyncHandler(async (req, res) => {
  const deleted = await HolidayModel.remove(req.companyId, req.params.id);
  if (!deleted) return res.status(404).json({ error: "Holiday not found" });
  res.json({ success: true });
}));

module.exports = router;

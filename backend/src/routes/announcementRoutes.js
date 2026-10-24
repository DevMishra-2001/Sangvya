const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, requirePermission } = require("../middleware/auth");
const { scopeToCompany } = require("../middleware/tenant");
const asyncHandler = require("../utils/asyncHandler");
const { query } = require("../config/db");
const { can } = require("../config/permissions");
const { localDate } = require("../utils/workday");

const router = express.Router();
router.use(authenticate, scopeToCompany);

// Employees whose birthday is today (company timezone), sorted by name.
// 29 Feb birthdays are celebrated on 28 Feb in non-leap years.
async function todaysBirthdays(companyId) {
  const today = localDate(); // "YYYY-MM-DD"
  const year = Number(today.slice(0, 4));
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const monthDays = [today.slice(5)];
  if (!isLeap && today.slice(5) === "02-28") monthDays.push("02-29");

  const res = await query(
    `SELECT id, name, designation FROM employees
     WHERE company_id = $1 AND date_of_birth IS NOT NULL
       AND to_char(date_of_birth, 'MM-DD') = ANY($2::text[])
     ORDER BY name`,
    [companyId, monthDays]
  );
  return res.rows.map((e) => ({ employeeId: e.id, name: e.name, designation: e.designation }));
}

// GET /api/announcements/feed — announcements + today's birthdays for the dashboard
router.get("/feed", asyncHandler(async (req, res) => {
  const announcements = await query(
    `SELECT a.*, u.name AS created_by_name
     FROM announcements a LEFT JOIN users u ON u.id = a.created_by
     WHERE a.company_id = $1
     ORDER BY a.created_at DESC LIMIT 20`,
    [req.companyId]
  );
  res.json({
    announcements: announcements.rows.map((a) => ({
      ...a,
      canDelete: a.created_by === req.user.id || can(req.user.role, "users.manage"),
    })),
    birthdays: await todaysBirthdays(req.companyId),
  });
}));

router.post(
  "/",
  requirePermission("announcements.manage"),
  [
    body("title").trim().notEmpty().withMessage("Title is required").isLength({ max: 200 }),
    body("message").optional().trim(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await query(
      `INSERT INTO announcements (company_id, title, message, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.companyId, req.body.title, req.body.message || null, req.user.id]
    );
    res.status(201).json({ announcement: { ...result.rows[0], created_by_name: null, canDelete: true } });
  })
);

// Author can delete their own; HR/superadmin can delete any
router.delete("/:id", requirePermission("announcements.manage"), asyncHandler(async (req, res) => {
  const existing = await query(`SELECT * FROM announcements WHERE company_id = $1 AND id = $2`, [req.companyId, req.params.id]);
  const a = existing.rows[0];
  if (!a) return res.status(404).json({ error: "Announcement not found" });
  if (a.created_by !== req.user.id && !can(req.user.role, "users.manage")) {
    return res.status(403).json({ error: "You can only delete your own announcements" });
  }
  await query(`DELETE FROM announcements WHERE id = $1`, [a.id]);
  res.json({ success: true });
}));

module.exports = router;

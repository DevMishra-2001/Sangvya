const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const settingsController = require("../controllers/settingsController");
const { strongPassword } = require("../utils/passwordPolicy");

const { FONT_SIZE } = settingsController;
const router = express.Router();

// Personal settings — every role (superadmin, hr, manager, employee) manages their own.
router.use(authenticate);

router.get("/font-size", asyncHandler(settingsController.getFontSize));
router.put(
  "/font-size",
  [
    body("fontSize")
      .isInt({ min: FONT_SIZE.min, max: FONT_SIZE.max })
      .withMessage(`fontSize must be a whole number from ${FONT_SIZE.min} to ${FONT_SIZE.max}`)
      .bail()
      .custom((v) => typeof v === "number") // reject "15" strings / 14.5
      .withMessage("fontSize must be a number")
      .toInt(),
  ],
  validate,
  asyncHandler(settingsController.updateFontSize)
);

router.put(
  "/password",
  [
    strongPassword(body("newPassword")),
  ],
  validate,
  asyncHandler(settingsController.updatePassword)
);

module.exports = router;

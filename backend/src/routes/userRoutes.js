const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, requirePermission } = require("../middleware/auth");
const { scopeToCompany } = require("../middleware/tenant");
const asyncHandler = require("../utils/asyncHandler");
const { ROLES } = require("../config/permissions");
const userController = require("../controllers/userController");
const { strongPassword } = require("../utils/passwordPolicy");

const router = express.Router();
router.use(authenticate, scopeToCompany, requirePermission("users.manage"));

router.get("/", asyncHandler(userController.list));

router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    strongPassword(body("password")),
    body("role").isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(", ")}`),
    body("employeeId").optional({ values: "falsy" }).isUUID().withMessage("Invalid employeeId"),
  ],
  validate,
  asyncHandler(userController.create)
);

router.put(
  "/:id",
  [
    body("role").optional().isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(", ")}`),
    body("employeeId").optional({ values: "falsy" }).isUUID().withMessage("Invalid employeeId"),
  ],
  validate,
  asyncHandler(userController.update)
);

router.delete("/:id", asyncHandler(userController.remove));

module.exports = router;

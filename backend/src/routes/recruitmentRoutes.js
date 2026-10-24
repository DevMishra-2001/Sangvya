const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate, requirePermission } = require("../middleware/auth");
const { scopeToCompany } = require("../middleware/tenant");
const asyncHandler = require("../utils/asyncHandler");
const jobController = require("../controllers/jobController");
const candidateController = require("../controllers/candidateController");

const router = express.Router();
router.use(authenticate, scopeToCompany);

// ---- Job postings ----
router.get("/jobs", requirePermission("recruitment.view"), asyncHandler(jobController.list));

router.post(
  "/jobs",
  requirePermission("recruitment.manage"),
  [body("title").trim().notEmpty().withMessage("Job title is required")],
  validate,
  asyncHandler(jobController.create)
);

router.patch("/jobs/:id/status", requirePermission("recruitment.manage"), asyncHandler(jobController.updateStatus));
router.delete("/jobs/:id", requirePermission("recruitment.manage"), asyncHandler(jobController.remove));

// ---- Candidates ----
router.get("/candidates", requirePermission("recruitment.view"), asyncHandler(candidateController.list));

router.post(
  "/candidates",
  requirePermission("recruitment.candidates"),
  [
    body("jobPostingId").isUUID().withMessage("Valid jobPostingId is required"),
    body("name").trim().notEmpty().withMessage("Candidate name is required"),
  ],
  validate,
  asyncHandler(candidateController.create)
);

router.patch("/candidates/:id/stage", requirePermission("recruitment.candidates"), asyncHandler(candidateController.updateStage));
router.put("/candidates/:id", requirePermission("recruitment.candidates"), asyncHandler(candidateController.update));
router.delete("/candidates/:id", requirePermission("recruitment.manage"), asyncHandler(candidateController.remove));
router.post("/candidates/:id/convert-to-employee", requirePermission("recruitment.manage"), asyncHandler(candidateController.convertToEmployee));

module.exports = router;

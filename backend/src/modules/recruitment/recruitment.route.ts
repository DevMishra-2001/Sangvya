import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import {
  convertToEmployeeHandler,
  createCandidateHandler,
  createJobHandler,
  deleteCandidateHandler,
  deleteJobHandler,
  listCandidatesHandler,
  listJobsHandler,
  updateCandidateHandler,
  updateCandidateStageHandler,
  updateJobStatusHandler,
} from "./recruitment.controller.js";
import { candidateSchema, candidateStageSchema, candidateUpdateSchema, jobSchema, jobStatusSchema } from "./recruitment.schema.js";

const router = Router();
router.use(authenticate, scopeToCompany);

// ---- Job postings ----
router.get("/jobs", requirePermission("recruitment.view"), listJobsHandler);
router.post("/jobs", requirePermission("recruitment.manage"), validate({ body: jobSchema }), createJobHandler);
router.patch("/jobs/:id/status", requirePermission("recruitment.manage"), validate({ params: idParams, body: jobStatusSchema }), updateJobStatusHandler);
router.delete("/jobs/:id", requirePermission("recruitment.manage"), validate({ params: idParams }), deleteJobHandler);

// ---- Candidates ----
router.get("/candidates", requirePermission("recruitment.view"), listCandidatesHandler);
router.post("/candidates", requirePermission("recruitment.candidates"), validate({ body: candidateSchema }), createCandidateHandler);
router.patch(
  "/candidates/:id/stage",
  requirePermission("recruitment.candidates"),
  validate({ params: idParams, body: candidateStageSchema }),
  updateCandidateStageHandler,
);
router.put("/candidates/:id", requirePermission("recruitment.candidates"), validate({ params: idParams, body: candidateUpdateSchema }), updateCandidateHandler);
router.delete("/candidates/:id", requirePermission("recruitment.manage"), validate({ params: idParams }), deleteCandidateHandler);
router.post("/candidates/:id/convert-to-employee", requirePermission("recruitment.manage"), validate({ params: idParams }), convertToEmployeeHandler);

export const recruitmentRoutes = router;

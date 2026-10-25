import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { tenant } from "../../utils/requestContext.js";
import {
  convertToEmployee,
  createCandidate,
  createJob,
  deleteCandidate,
  deleteJob,
  listCandidates,
  listJobs,
  updateCandidate,
  updateCandidateStage,
  updateJobStatus,
} from "./recruitment.service.js";

// ---- Job postings ----

// GET /api/recruitment/jobs
export const listJobsHandler = asyncHandler(async (req, res) => {
  res.json(await listJobs(tenant(req).companyId));
});

// POST /api/recruitment/jobs
export const createJobHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await createJob(tenant(req).companyId, req.body));
});

// PATCH /api/recruitment/jobs/:id/status  { status }
export const updateJobStatusHandler = asyncHandler(async (req, res) => {
  res.json(await updateJobStatus(tenant(req).companyId, Number(req.params.id), req.body.status));
});

// DELETE /api/recruitment/jobs/:id
export const deleteJobHandler = asyncHandler(async (req, res) => {
  await deleteJob(tenant(req).companyId, Number(req.params.id));
  res.json({ success: true });
});

// ---- Candidates ----

// GET /api/recruitment/candidates
export const listCandidatesHandler = asyncHandler(async (req, res) => {
  res.json(await listCandidates(tenant(req).companyId));
});

// POST /api/recruitment/candidates
export const createCandidateHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await createCandidate(tenant(req).companyId, req.body));
});

// PATCH /api/recruitment/candidates/:id/stage  { stage }
export const updateCandidateStageHandler = asyncHandler(async (req, res) => {
  res.json(await updateCandidateStage(tenant(req).companyId, Number(req.params.id), req.body.stage));
});

// PUT /api/recruitment/candidates/:id
export const updateCandidateHandler = asyncHandler(async (req, res) => {
  res.json(await updateCandidate(tenant(req).companyId, Number(req.params.id), req.body));
});

// DELETE /api/recruitment/candidates/:id
export const deleteCandidateHandler = asyncHandler(async (req, res) => {
  await deleteCandidate(tenant(req).companyId, Number(req.params.id));
  res.json({ success: true });
});

// POST /api/recruitment/candidates/:id/convert-to-employee
export const convertToEmployeeHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await convertToEmployee(tenant(req).companyId, Number(req.params.id)));
});

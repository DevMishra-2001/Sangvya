import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { tenant } from "../../utils/requestContext.js";
import {
  createCycle,
  listCycles,
  listReviewsByCycle,
  listReviewsByEmployee,
  updateCycleStatus,
  updateReviewStatus,
  upsertReview,
} from "./performance.service.js";

// GET /api/performance/cycles
export const listCyclesHandler = asyncHandler(async (req, res) => {
  res.json(await listCycles(tenant(req).companyId));
});

// POST /api/performance/cycles
export const createCycleHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await createCycle(tenant(req).companyId, req.body));
});

// PATCH /api/performance/cycles/:id/status  { status }
export const updateCycleStatusHandler = asyncHandler(async (req, res) => {
  res.json(await updateCycleStatus(tenant(req).companyId, Number(req.params.id), req.body.status));
});

// GET /api/performance/cycles/:cycleId/reviews
export const cycleReviewsHandler = asyncHandler(async (req, res) => {
  res.json(await listReviewsByCycle(tenant(req).companyId, Number(req.params.cycleId)));
});

// GET /api/performance/employees/:employeeId/reviews
export const employeeReviewsHandler = asyncHandler(async (req, res) => {
  res.json(await listReviewsByEmployee(tenant(req).companyId, Number(req.params.employeeId)));
});

// POST /api/performance/reviews — create or update (draft/submit)
export const upsertReviewHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await upsertReview(tenant(req).companyId, req.body));
});

// PATCH /api/performance/reviews/:id/status  { status }
export const updateReviewStatusHandler = asyncHandler(async (req, res) => {
  res.json(await updateReviewStatus(tenant(req).companyId, Number(req.params.id), req.body.status));
});

import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { tenant } from "../../utils/requestContext.js";
import { DEFAULT_DESIGNATIONS, createDesignation, deleteDesignation, listDesignations, renameDesignation } from "./designations.service.js";

// GET /api/designations
export const listDesignationsHandler = asyncHandler(async (req, res) => {
  res.json(await listDesignations(tenant(req).companyId));
});

// GET /api/designations/defaults — the starter list (also shown before a company exists)
export const defaultDesignationsHandler = asyncHandler(async (_req, res) => {
  res.json({ designations: DEFAULT_DESIGNATIONS });
});

// POST /api/designations  { name }
export const createDesignationHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await createDesignation(tenant(req).companyId, req.body.name));
});

// PATCH /api/designations/:id  { name }
export const renameDesignationHandler = asyncHandler(async (req, res) => {
  res.json(await renameDesignation(tenant(req).companyId, Number(req.params.id), req.body.name));
});

// DELETE /api/designations/:id
export const deleteDesignationHandler = asyncHandler(async (req, res) => {
  await deleteDesignation(tenant(req).companyId, Number(req.params.id));
  res.json({ success: true });
});

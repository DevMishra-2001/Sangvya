import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { tenant } from "../../utils/requestContext.js";
import { createDesignation, deleteDesignation, listDesignations, updateDesignation } from "./designations.service.js";

// GET /api/designations
export const listDesignationsHandler = asyncHandler(async (req, res) => {
  res.json(await listDesignations(tenant(req).companyId));
});

// POST /api/designations  { name, isActive? }
export const createDesignationHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await createDesignation(tenant(req).companyId, req.body));
});

// PUT /api/designations/:id  { name, isActive }
export const updateDesignationHandler = asyncHandler(async (req, res) => {
  res.json(await updateDesignation(tenant(req).companyId, Number(req.params.id), req.body));
});

// DELETE /api/designations/:id
export const deleteDesignationHandler = asyncHandler(async (req, res) => {
  await deleteDesignation(tenant(req).companyId, Number(req.params.id));
  res.json({ success: true });
});

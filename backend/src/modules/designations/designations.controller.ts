import { asyncHandler } from "../../utils/asyncHandler.js";
import { tenant } from "../../utils/requestContext.js";
import { listDesignations, updateDesignation } from "./designations.service.js";

// GET /api/designations
export const listDesignationsHandler = asyncHandler(async (req, res) => {
  res.json(await listDesignations(tenant(req).companyId));
});

// PATCH /api/designations/:id  { name?, isActive? }  (Super Admin)
export const updateDesignationHandler = asyncHandler(async (req, res) => {
  res.json(await updateDesignation(Number(req.params.id), req.body));
});

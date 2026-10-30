import { asyncHandler } from "../../utils/asyncHandler.js";
import { currentUser } from "../../utils/requestContext.js";
import { listRoles, updateRole } from "./roles.service.js";

// GET /api/roles
export const listRolesHandler = asyncHandler(async (req, res) => {
  res.json(await listRoles(currentUser(req).companyId));
});

// PATCH /api/roles/:id  { name?, isActive? }  (Super Admin)
export const updateRoleHandler = asyncHandler(async (req, res) => {
  res.json(await updateRole(currentUser(req), Number(req.params.id), req.body));
});

import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { createDepartment, deleteDepartment, listDepartments, updateDepartment } from "./departments.service.js";

// GET /api/departments
export const listDepartmentsHandler = asyncHandler(async (req, res) => {
  res.json(await listDepartments(tenant(req).companyId));
});

// POST /api/departments  { name, code?, headId?, isActive? }
export const createDepartmentHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await createDepartment(tenant(req).companyId, currentUser(req), req.body));
});

// PUT /api/departments/:id
export const updateDepartmentHandler = asyncHandler(async (req, res) => {
  res.json(await updateDepartment(tenant(req).companyId, currentUser(req), Number(req.params.id), req.body));
});

// DELETE /api/departments/:id
export const deleteDepartmentHandler = asyncHandler(async (req, res) => {
  await deleteDepartment(tenant(req).companyId, currentUser(req), Number(req.params.id));
  res.json({ success: true });
});

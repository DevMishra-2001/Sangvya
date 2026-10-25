import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { tenant } from "../../utils/requestContext.js";
import { createEmployee, deleteEmployee, listEmployees, updateEmployee } from "./employees.service.js";

// GET /api/employees
export const listEmployeesHandler = asyncHandler(async (req, res) => {
  res.json(await listEmployees(tenant(req).companyId));
});

// POST /api/employees
export const createEmployeeHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await createEmployee(tenant(req).companyId, req.body));
});

// PUT /api/employees/:id
export const updateEmployeeHandler = asyncHandler(async (req, res) => {
  res.json(await updateEmployee(tenant(req).companyId, Number(req.params.id), req.body));
});

// DELETE /api/employees/:id
export const deleteEmployeeHandler = asyncHandler(async (req, res) => {
  await deleteEmployee(tenant(req).companyId, Number(req.params.id));
  res.json({ success: true });
});

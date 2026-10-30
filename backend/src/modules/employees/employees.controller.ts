import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { createEmployeeWithLogin, updateEmployeeWithLogin } from "./employeeAccount.service.js";
import { deleteEmployee, listEmployees } from "./employees.service.js";

// GET /api/employees
export const listEmployeesHandler = asyncHandler(async (req, res) => {
  res.json(await listEmployees(tenant(req).companyId));
});

// POST /api/employees
export const createEmployeeHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await createEmployeeWithLogin(tenant(req).companyId, currentUser(req), req.body));
});

// PUT /api/employees/:id
export const updateEmployeeHandler = asyncHandler(async (req, res) => {
  res.json(await updateEmployeeWithLogin(tenant(req).companyId, currentUser(req), Number(req.params.id), req.body));
});

// DELETE /api/employees/:id
export const deleteEmployeeHandler = asyncHandler(async (req, res) => {
  await deleteEmployee(tenant(req).companyId, currentUser(req), Number(req.params.id));
  res.json({ success: true });
});


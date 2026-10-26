import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { createAdmin, deleteAdmin, listAdmins } from "./admins.service.js";

// GET /api/admins
export const listAdminsHandler = asyncHandler(async (_req, res) => {
  res.json(await listAdmins());
});

// POST /api/admins  { name, email, password }
export const createAdminHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await createAdmin(req.body));
});

// DELETE /api/admins/:id  (only before they've set up a company)
export const deleteAdminHandler = asyncHandler(async (req, res) => {
  await deleteAdmin(Number(req.params.id));
  res.json({ success: true });
});

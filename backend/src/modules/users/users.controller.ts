import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { tenant } from "../../utils/requestContext.js";
import { createUser, deleteUser, listUsers, updateUser } from "./users.service.js";

// GET /api/users
export const listUsersHandler = asyncHandler(async (req, res) => {
  const { companyId } = tenant(req);
  res.json(await listUsers(companyId));
});

// POST /api/users
export const createUserHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  res.status(HttpStatus.CREATED).json({ user: await createUser(companyId, user, req.body) });
});

// PUT /api/users/:id
export const updateUserHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  res.json({ user: await updateUser(companyId, user, Number(req.params.id), req.body) });
});

// DELETE /api/users/:id
export const deleteUserHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  await deleteUser(companyId, user, Number(req.params.id));
  res.json({ success: true });
});

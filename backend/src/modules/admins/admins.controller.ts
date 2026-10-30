import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser } from "../../utils/requestContext.js";
import { deleteAdmin, inviteAdmin, listAdmins, resendInvite } from "./admins.service.js";

// GET /api/admins
export const listAdminsHandler = asyncHandler(async (_req, res) => {
  res.json(await listAdmins());
});

// POST /api/admins  { name, email, companyName? } → emails an activation link
// (outside production the link is also in the response, for testing)
export const inviteAdminHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await inviteAdmin(req.body, currentUser(req)));
});

// POST /api/admins/:id/resend
export const resendInviteHandler = asyncHandler(async (req, res) => {
  res.json(await resendInvite(Number(req.params.id), currentUser(req)));
});

// DELETE /api/admins/:id  (only before they've set up a company)
export const deleteAdminHandler = asyncHandler(async (req, res) => {
  await deleteAdmin(Number(req.params.id), currentUser(req));
  res.json({ success: true });
});

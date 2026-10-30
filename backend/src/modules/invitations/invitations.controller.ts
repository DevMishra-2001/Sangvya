import { asyncHandler } from "../../utils/asyncHandler.js";
import { acceptInvitation, verifyInvitation } from "./invitations.service.js";

// POST /api/auth/invite/verify  { token }
export const verifyInviteHandler = asyncHandler(async (req, res) => {
  res.json(await verifyInvitation(req.body.token));
});

// POST /api/auth/invite/accept  { token, password } → logged in
export const acceptInviteHandler = asyncHandler(async (req, res) => {
  res.json(await acceptInvitation(req, res, req.body.token, req.body.password));
});

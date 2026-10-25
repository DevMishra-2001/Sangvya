import { asyncHandler } from "../../utils/asyncHandler.js";
import { currentUser } from "../../utils/requestContext.js";
import { getFontSize, updateFontSize, updatePassword } from "./settings.service.js";

// GET /api/settings/font-size
export const getFontSizeHandler = asyncHandler(async (req, res) => {
  res.json(await getFontSize(currentUser(req).id));
});

// PUT /api/settings/font-size  { fontSize: 15 }
export const updateFontSizeHandler = asyncHandler(async (req, res) => {
  res.json(await updateFontSize(currentUser(req).id, req.body.fontSize));
});

// PUT /api/settings/password  { newPassword }
export const updatePasswordHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  res.json(await updatePassword(user.id, user.sessionId, req.body.newPassword));
});

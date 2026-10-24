const bcrypt = require("bcryptjs");
const UserModel = require("../models/userModel");
const SessionModel = require("../models/sessionModel");

// Personal settings: every handler reads/writes only the logged-in user's own
// row (req.user.id from their token) — never anyone else's.
const FONT_SIZE = { min: 10, max: 17, default: 13 };

// GET /api/settings/font-size
async function getFontSize(req, res) {
  const user = await UserModel.findById(req.user.id);
  res.json({ fontSize: user?.font_size ?? FONT_SIZE.default });
}

// PUT /api/settings/font-size  { fontSize: 15 }
async function updateFontSize(req, res) {
  const fontSize = await UserModel.updateFontSize(req.user.id, req.body.fontSize);
  res.json({ fontSize });
}

// PUT /api/settings/password  { newPassword }
// The logged-in user sets a new password for their own account (no old password
// needed — they're already authenticated by their token).
async function updatePassword(req, res) {
  const { newPassword } = req.body;
  const user = await UserModel.findWithPasswordById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (await bcrypt.compare(newPassword, user.password_hash)) {
    return res.status(400).json({ error: "New password must be different from the current one" });
  }
  await UserModel.updatePassword(req.user.id, await bcrypt.hash(newPassword, 10));
  // Log out every other device; this one stays signed in
  await SessionModel.revokeAllForUser(req.user.id, req.user.sessionId);
  res.json({ success: true });
}

module.exports = { getFontSize, updateFontSize, updatePassword, FONT_SIZE };

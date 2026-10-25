// Personal settings: every function reads/writes only the logged-in user's own
// row (the id from their token) — never anyone else's.
import bcrypt from "bcryptjs";
import { BadRequestError, NotFoundError } from "../../utils/httpErrors.js";
import { revokeAllSessionsForUser } from "../auth/session.service.js";
import { findUserById, findUserWithPassword, setUserFontSize, setUserPassword } from "../users/users.service.js";
import { FONT_SIZE } from "./settings.schema.js";

export async function getFontSize(userId: number) {
  const user = await findUserById(userId);
  return { fontSize: user?.font_size ?? FONT_SIZE.default };
}

export async function updateFontSize(userId: number, fontSize: number) {
  return { fontSize: await setUserFontSize(userId, fontSize) };
}

// The logged-in user sets a new password (no old password needed — they're
// already authenticated). Every other device is logged out; this one stays.
export async function updatePassword(userId: number, sessionId: number, newPassword: string) {
  const user = await findUserWithPassword(userId);
  if (!user) throw new NotFoundError("User not found");
  if (await bcrypt.compare(newPassword, user.password_hash)) {
    throw new BadRequestError("New password must be different from the current one");
  }
  await setUserPassword(userId, await bcrypt.hash(newPassword, 10));
  await revokeAllSessionsForUser(userId, sessionId);
  return { success: true };
}

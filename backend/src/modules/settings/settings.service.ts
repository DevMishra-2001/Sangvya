// Personal settings: every function reads/writes only the logged-in user's own
// row (the id from their token) — never anyone else's.
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { users } from "../../db/schema.js";
import { BadRequestError, NotFoundError } from "../../utils/httpErrors.js";
import { revokeAllSessionsForUser } from "../auth/session.service.js";
import { findUserById, findUserWithPassword, setUserFontSize, setUserPassword } from "../users/users.service.js";
import { FONT_SIZE, type PreferencesInput } from "./settings.schema.js";

export async function getFontSize(userId: number) {
  const user = await findUserById(userId);
  return { fontSize: user?.font_size ?? FONT_SIZE.default };
}

export async function updateFontSize(userId: number, fontSize: number) {
  return { fontSize: await setUserFontSize(userId, fontSize) };
}

// Theme / accent / menu layout — only the ones sent change
export async function updatePreferences(userId: number, input: PreferencesInput) {
  const [row] = await db
    .update(users)
    .set({
      ...(input.theme ? { theme: input.theme } : {}),
      ...(input.accent ? { accent: input.accent } : {}),
      ...(input.menuLayout ? { menu_layout: input.menuLayout } : {}),
    })
    .where(eq(users.id, userId))
    .returning({ theme: users.theme, accent: users.accent, menu_layout: users.menu_layout });
  if (!row) throw new NotFoundError("User not found");
  return { preferences: row };
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

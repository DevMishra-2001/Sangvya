// Server-only helpers for reading the backend's access token in proxy.ts.
import { jwtVerify } from "jose";

export const ACCESS_COOKIE = "sangvya_token";
export const REFRESH_COOKIE = "sangvya_refresh";

export interface AccessTokenPayload {
  id: number;
  companyId: number | null; // null until a new superadmin creates their company
  sid: number;
  pages: string[]; // URLs this user's designation can open (Page Master)
}

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not set for frontendnext — use the same value as the backend.");
  return new TextEncoder().encode(value);
}

// The token's payload, or null if it's missing, expired, tampered with, or
// from before tokens carried page URLs.
export async function verifyAccessToken(token: string | undefined): Promise<AccessTokenPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const p = payload as Partial<AccessTokenPayload>;
    if (typeof p.id !== "number" || !Array.isArray(p.pages)) return null;
    return p as AccessTokenPayload;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("JWT_SECRET")) throw err;
    return null;
  }
}

// "sangvya_token=abc; Path=/; HttpOnly" → "abc" (for the cookie named `name`)
export function cookieValueFromSetCookie(setCookies: string[], name: string): string | undefined {
  for (const header of setCookies) {
    const [pair] = header.split(";");
    const eq = pair.indexOf("=");
    if (pair.slice(0, eq).trim() === name) {
      const value = pair.slice(eq + 1).trim();
      return value || undefined;
    }
  }
  return undefined;
}

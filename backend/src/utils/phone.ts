import { z } from "zod";

// Indian mobile (10 digits starting 6–9, optional +91 / 91 / 0) → "+91 98765 43210"; other countries +<8–15 digits>
export function normalizePhone(raw: string): string | null {
  const v = raw.trim().replace(/[\s().-]/g, "");
  let m = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(v);
  if (m) return `+91 ${m[1].slice(0, 5)} ${m[1].slice(5)}`;
  m = /^\+(\d{8,15})$/.exec(v);
  if (m && !m[1].startsWith("91")) return `+${m[1]}`;
  return null;
}

export const PHONE_MESSAGE = "Enter a 10-digit mobile number (e.g. 98765 43210) or +country code";

// Optional phone: "" → null, undefined stays undefined (not sent), anything else must be valid
export const optionalPhone = (message = PHONE_MESSAGE) =>
  z.preprocess(
    (v) => (v === undefined ? undefined : (typeof v === "string" ? v.trim() : v) || null),
    z
      .string()
      .nullable()
      .optional()
      .refine((v) => v == null || normalizePhone(v) !== null, message)
      .transform((v) => (v == null ? v : normalizePhone(v)!)),
  );

// Same rules as the backend (utils/phone.ts): Indian mobile → "+91 98765 43210", other countries +<8–15 digits>
export function normalizePhone(raw: string): string | null {
  const v = raw.trim().replace(/[\s().-]/g, "");
  let m = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(v);
  if (m) return `+91 ${m[1].slice(0, 5)} ${m[1].slice(5)}`;
  m = /^\+(\d{8,15})$/.exec(v);
  if (m && !m[1].startsWith("91")) return `+${m[1]}`;
  return null;
}

export const PHONE_MESSAGE = "Enter a 10-digit mobile number (e.g. 98765 43210) or +country code";


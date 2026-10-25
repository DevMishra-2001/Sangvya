// Reusable Zod building blocks for request schemas. Form inputs arrive as
// strings ("5000", "3", ""), so number/id fields accept numeric strings and
// empty values mean "not set".
import { z } from "zod";

const isBlank = (v: unknown) => v === "" || v === null || v === undefined;

// "12" → 12, 12 → 12; anything else is left for Zod to reject
const toNumber = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v);

// Falsy form values ("", null, 0, false) → null, so they clear the field
const falsyToNull = (v: unknown) => (v === undefined ? undefined : v || null);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Non-empty trimmed string. */
export const requiredText = (message: string, max?: number) => {
  const base = z.string({ required_error: message, invalid_type_error: message }).trim().min(1, message);
  return max ? base.max(max, `${message.replace(/ is required$/, "")} can be at most ${max} characters`) : base;
};

/** Free text that may be missing, null or empty. */
export const optionalText = () => z.string().nullish();

/** Required number (numeric strings accepted). */
export const numberField = (message: string, { min, max, int = false }: { min?: number; max?: number; int?: boolean } = {}) => {
  let n = z.number({ required_error: message, invalid_type_error: message });
  if (int) n = n.int(message);
  if (min !== undefined) n = n.min(min, message);
  if (max !== undefined) n = n.max(max, message);
  return z.preprocess(toNumber, n);
};

/** Optional number: "", null or missing → null. */
export const optionalNumber = (message: string, opts: { min?: number; max?: number; int?: boolean } = {}) =>
  z.preprocess((v) => (isBlank(v) ? null : v), numberField(message, opts).nullable()).optional();

/** Required id (auto-increment integer; numeric strings accepted). */
export const idField = (message = "Invalid id") => numberField(message, { int: true, min: 1 });

/** Optional id: "", null, 0 → null (clears a link); missing → undefined (leave as is). */
export const optionalId = (message = "Invalid id") =>
  z.preprocess(falsyToNull, idField(message).nullable().optional());

/** YYYY-MM-DD (an ISO timestamp is also accepted, like before). */
export const isoDate = (message: string) =>
  z
    .string({ required_error: message, invalid_type_error: message })
    .refine((v) => ISO_DATE.test(v) && !Number.isNaN(Date.parse(v)), message);

/** Optional date: "", null or missing → null. */
export const optionalIsoDate = (message: string) =>
  z.preprocess((v) => (isBlank(v) ? null : v), isoDate(message).nullable()).optional();

/** One of a fixed list of strings. */
export const oneOf = <T extends string>(values: readonly [T, ...T[]], message: string) =>
  z.enum(values, { errorMap: () => ({ message }) });

/** `:id` route param. */
export const idParams = z.object({ id: idField() });

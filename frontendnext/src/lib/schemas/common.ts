// Shared form-field rules. Form inputs hold strings; these turn them into the
// values the API expects ("" → null, "12" → 12).
import { z } from "zod";

export const requiredText = (message: string, max?: number) => {
  const base = z.string().trim().min(1, message);
  return max ? base.max(max, `Must be at most ${max} characters`) : base;
};

// "" → null
export const optionalText = (max?: number) =>
  (max ? z.string().trim().max(max, `Must be at most ${max} characters`) : z.string().trim()).transform((v) => v || null);

export const isoDate = (message: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message);

// "" → null
export const optionalDate = z
  .string()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Invalid date")
  .transform((v) => v || null);

// "12" → 12, "" → null
export const optionalNumber = (message: string, { min, max }: { min?: number; max?: number } = {}) =>
  z
    .string()
    .trim()
    .refine((v) => {
      if (v === "") return true;
      const n = Number(v);
      return Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max);
    }, message)
    .transform((v) => (v === "" ? null : Number(v)));

export const requiredNumber = (message: string, { min, max }: { min?: number; max?: number } = {}) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((v) => {
      const n = Number(v);
      return Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max);
    }, message)
    .transform(Number);

// <select> value "5" → 5, "" → null
export const optionalId = z.string().transform((v) => (v ? Number(v) : null));
export const requiredId = (message: string) => z.string().min(1, message).transform(Number);

export const email = z.string().trim().email("Enter a valid email");

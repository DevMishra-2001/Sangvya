import { z } from "zod";
import { strongPassword } from "../../utils/passwordPolicy.js";

export const FONT_SIZE = { min: 10, max: 17, default: 13 };

const wholeNumber = `fontSize must be a whole number from ${FONT_SIZE.min} to ${FONT_SIZE.max}`;

// A real JSON number only — "15" strings are rejected
export const fontSizeSchema = z.object({
  fontSize: z
    .number({ required_error: wholeNumber, invalid_type_error: "fontSize must be a number" })
    .int(wholeNumber)
    .min(FONT_SIZE.min, wholeNumber)
    .max(FONT_SIZE.max, wholeNumber),
});

export const passwordSchema = z.object({
  newPassword: strongPassword,
});

export const ACCENTS = ["neutral", "blue", "green", "red", "orange", "violet", "rose"] as const;

// PUT /api/settings/preferences — any subset
export const preferencesSchema = z
  .object({
    theme: z.enum(["light", "dark", "system"], { errorMap: () => ({ message: "theme must be light, dark or system" }) }).optional(),
    accent: z.enum(ACCENTS, { errorMap: () => ({ message: `accent must be one of: ${ACCENTS.join(", ")}` }) }).optional(),
    menuLayout: z.enum(["vertical", "horizontal"], { errorMap: () => ({ message: "menuLayout must be vertical or horizontal" }) }).optional(),
  })
  .refine((v) => v.theme || v.accent || v.menuLayout, { message: "Nothing to save" });
export type PreferencesInput = z.infer<typeof preferencesSchema>;

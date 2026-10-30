import { z } from "zod";

const optionalText = (max: number, label: string) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v) || undefined, z.string().max(max, `${label} can be at most ${max} characters`).optional());

export const reportSettingsSchema = z.object({
  letterhead: z.boolean(),
  showLogo: z.boolean(),
  showAddress: z.boolean(),
  showContact: z.boolean(),
  showTaxIds: z.boolean(),
  footerText: optionalText(200, "Footer text"),
  watermark: optionalText(40, "Watermark"),
  signatureLabel: optionalText(60, "Signature label"),
  showGenerated: z.boolean(),
});
export type ReportSettingsInput = z.infer<typeof reportSettingsSchema>;

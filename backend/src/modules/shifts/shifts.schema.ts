import { z } from "zod";
import { requiredText } from "../../utils/zod.js";

const time = (label: string) => z.string({ required_error: `${label} is required` }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label} must be a time like 09:30`);
const minutes = (label: string, max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v), z.number({ invalid_type_error: `${label} must be a number` }).int(`${label} must be whole minutes`).min(0, `${label} can't be negative`).max(max, `${label} can be at most ${max} minutes`));

// Add / edit a shift
export const shiftSchema = z
  .object({
    name: requiredText("Shift name is required", 60),
    startTime: time("Start time"),
    endTime: time("End time"),
    graceMinutes: minutes("Grace time", 180).default(10),
    breakMinutes: minutes("Break time", 240).default(60),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.startTime !== v.endTime, { path: ["endTime"], message: "End time must be different from the start time" })
  .refine((v) => !(v.isDefault && !v.isActive), { path: ["isActive"], message: "The default shift must be active" });

export type ShiftInput = z.infer<typeof shiftSchema>;

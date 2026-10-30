import { z } from "zod";
import { requiredText } from "./common";

const time = (label: string) => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `Pick the ${label}`);
const minutes = (label: string, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) <= max, `${label}: 0 to ${max} minutes`)
    .transform(Number);

export const shiftSchema = z
  .object({
    name: requiredText("Shift name is required", 60),
    startTime: time("start time"),
    endTime: time("end time"),
    graceMinutes: minutes("Grace time", 180),
    breakMinutes: minutes("Break time", 240),
    isDefault: z.enum(["yes", "no"]).transform((v) => v === "yes"),
    isActive: z.enum(["active", "inactive"]).transform((v) => v === "active"),
  })
  .refine((v) => v.startTime !== v.endTime, { path: ["endTime"], message: "End time must be different from the start" });

export type ShiftForm = z.input<typeof shiftSchema>;
export type ShiftPayload = z.output<typeof shiftSchema>;

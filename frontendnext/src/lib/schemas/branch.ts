import { z } from "zod";
import { optionalNumber, optionalText, requiredNumber, requiredText } from "./common";

export const branchSchema = z
  .object({
    name: requiredText("Branch name is required", 120),
    code: optionalText(20),
    address: optionalText(500),
    city: optionalText(100),
    state: optionalText(100),
    country: optionalText(100),
    postalCode: optionalText(20),
    phone: optionalText(30),
    email: z
      .string()
      .trim()
      .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email")
      .transform((v) => v || null),
    latitude: optionalNumber("Latitude is a number from -90 to 90", { min: -90, max: 90 }),
    longitude: optionalNumber("Longitude is a number from -180 to 180", { min: -180, max: 180 }),
    radiusM: requiredNumber("Radius is 25 to 5000 metres", { min: 25, max: 5000 }),
    geofence: z.enum(["on", "off"]),
    headOffice: z.enum(["yes", "no"]),
    status: z.enum(["active", "inactive"]),
  })
  .superRefine((v, ctx) => {
    if ((v.latitude === null) !== (v.longitude === null)) ctx.addIssue({ code: "custom", path: ["longitude"], message: "Enter both latitude and longitude" });
    if (v.geofence === "on" && v.latitude === null) ctx.addIssue({ code: "custom", path: ["latitude"], message: "Set the location to turn on the check-in radius" });
  })
  .transform(({ geofence, headOffice, status, ...v }) => ({ ...v, geofenceEnabled: geofence === "on", isHeadOffice: headOffice === "yes", isActive: status === "active" }));

export type BranchForm = z.input<typeof branchSchema>;
export type BranchPayload = z.output<typeof branchSchema>;

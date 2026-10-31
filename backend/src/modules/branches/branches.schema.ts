import { z } from "zod";
import { requiredText } from "../../utils/zod.js";

const text = (max: number, label: string) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v) || null, z.string().max(max, `${label} can be at most ${max} characters`).nullable());
const coord = (min: number, max: number, label: string) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number({ invalid_type_error: `${label} must be a number` }).min(min).max(max).nullable());

// POST / PUT /api/branches
export const branchSchema = z
  .object({
    name: requiredText("Branch name is required", 120),
    code: text(20, "Code"),
    address: text(500, "Address"),
    city: text(100, "City"),
    state: text(100, "State"),
    country: text(100, "Country"),
    postalCode: text(20, "Pincode"),
    phone: text(30, "Phone"),
    email: z.preprocess((v) => (typeof v === "string" ? v.trim() : v) || null, z.string().email("Enter a valid email").max(150).nullable()),
    latitude: coord(-90, 90, "Latitude"),
    longitude: coord(-180, 180, "Longitude"),
    radiusM: z.coerce.number({ invalid_type_error: "Radius must be a number" }).int().min(25, "Radius must be at least 25 m").max(5000, "Radius can be at most 5000 m").default(200),
    geofenceEnabled: z.boolean().default(false),
    isHeadOffice: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if ((v.latitude == null) !== (v.longitude == null)) ctx.addIssue({ code: "custom", path: ["longitude"], message: "Enter both latitude and longitude" });
    if (v.geofenceEnabled && (v.latitude == null || v.longitude == null)) {
      ctx.addIssue({ code: "custom", path: ["latitude"], message: "Set the location (latitude and longitude) to turn on the check-in radius" });
    }
  });
export type BranchInput = z.infer<typeof branchSchema>;

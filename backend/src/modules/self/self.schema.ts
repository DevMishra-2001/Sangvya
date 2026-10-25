import { z } from "zod";
import { optionalImageUrl } from "../../utils/imageUrl.js";
import { LOCATIONS } from "./attendanceStatus.js";

const optionalCoord = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().min(min).max(max).optional());

// Optional work mode, remarks, GPS position and selfie on check-in / check-out ("" = not given)
export const punchSchema = z.object({
  location: z
    .preprocess((v) => v || undefined, z.enum(LOCATIONS, { errorMap: () => ({ message: `Location must be one of: ${LOCATIONS.join(", ")}` }) }).optional()),
  remarks: z
    .preprocess((v) => v || undefined, z.string({ invalid_type_error: "Remarks can be at most 300 characters" }).max(300, "Remarks can be at most 300 characters").optional()),
  latitude: optionalCoord(-90, 90),
  longitude: optionalCoord(-180, 180),
  accuracy: optionalCoord(0, 1_000_000),
  photoUrl: optionalImageUrl("Photo must be uploaded first"),
});

// PUT /api/me/photo — null removes it
export const photoSchema = z.object({ photoUrl: optionalImageUrl() });

// Invalid or missing values fall back to the current month/day
export const monthQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional().catch(undefined),
});

export const dateQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
});

export type PunchInput = z.infer<typeof punchSchema>;

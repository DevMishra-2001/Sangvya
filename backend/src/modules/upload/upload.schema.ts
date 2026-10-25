import { z } from "zod";

export const UPLOAD_KINDS = ["company-logo", "employee-photo", "attendance-photo"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

// multipart/form-data text fields (the file itself is checked by multer)
export const uploadSchema = z.object({
  kind: z.enum(UPLOAD_KINDS, { errorMap: () => ({ message: `kind must be one of: ${UPLOAD_KINDS.join(", ")}` }) }),
});

// Image types accepted from the browser
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/heic", "image/heif"];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

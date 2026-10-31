import { z } from "zod";

// Kinds the browser may upload through POST /api/upload (documents go through their own record APIs)
export const UPLOAD_KINDS = ["company-logo", "employee-photo", "attendance-photo"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

// multipart/form-data text fields (the file itself is checked by storeFile)
export const uploadSchema = z.object({
  kind: z.enum(UPLOAD_KINDS, { errorMap: () => ({ message: `kind must be one of: ${UPLOAD_KINDS.join(", ")}` }) }),
});

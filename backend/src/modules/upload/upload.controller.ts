import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser } from "../../utils/requestContext.js";
import { storeFile } from "./upload.service.js";

// POST /api/upload  (multipart: file, kind) → { url, fileId, width, height }
export const uploadHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const stored = await storeFile(req.body.kind, { companyId: user.companyId, employeeId: user.employeeId }, req.file);
  res.status(HttpStatus.CREATED).json({ url: stored.url, fileId: stored.fileId, width: stored.width, height: stored.height });
});

import { asyncHandler } from "../../utils/asyncHandler.js";
import { BadRequestError } from "../../utils/httpErrors.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser } from "../../utils/requestContext.js";
import { uploadImage } from "./upload.service.js";

// POST /api/upload  (multipart: file, kind) → { url, fileId, width, height }
export const uploadHandler = asyncHandler(async (req, res) => {
  if (!req.file) throw new BadRequestError("Choose an image to upload");
  const result = await uploadImage(currentUser(req), req.body.kind, req.file);
  res.status(HttpStatus.CREATED).json(result);
});

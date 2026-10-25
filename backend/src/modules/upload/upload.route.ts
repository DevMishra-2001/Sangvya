import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { BadRequestError } from "../../utils/httpErrors.js";
import { uploadHandler } from "./upload.controller.js";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, uploadSchema } from "./upload.schema.js";

// Files are kept in memory only long enough to resize and send to ImageKit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new BadRequestError("Only images can be uploaded (JPEG, PNG, WebP, GIF, SVG, HEIC)"));
  },
});

// No scopeToCompany: a company logo is uploaded before the company exists
const router = Router();
router.post("/", authenticate, upload.single("file"), validate({ body: uploadSchema }), uploadHandler);

export const uploadRoutes = router;

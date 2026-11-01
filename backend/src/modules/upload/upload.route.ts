import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { uploadHandler } from "./upload.controller.js";
import { uploadSchema } from "./upload.schema.js";
import { fileUpload } from "./upload.service.js";

// No scopeToCompany: a company logo is uploaded before the company exists
const router = Router();
router.post("/", authenticate, fileUpload.single("file"), validate({ body: uploadSchema }), uploadHandler);

export const uploadRoutes = router;

import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { getFontSizeHandler, updateFontSizeHandler, updatePasswordHandler, updatePreferencesHandler } from "./settings.controller.js";
import { fontSizeSchema, passwordSchema, preferencesSchema } from "./settings.schema.js";

const router = Router();

// Personal settings — every role manages their own
router.use(authenticate);

router.get("/font-size", getFontSizeHandler);
router.put("/font-size", validate({ body: fontSizeSchema }), updateFontSizeHandler);
router.put("/preferences", validate({ body: preferencesSchema }), updatePreferencesHandler);
router.put("/password", validate({ body: passwordSchema }), updatePasswordHandler);

export const settingsRoutes = router;

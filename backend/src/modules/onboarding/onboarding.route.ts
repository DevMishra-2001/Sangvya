import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { idParams } from "../../utils/zod.js";
import { documentSchema } from "../employees/employees.schema.js";
import { fileUpload } from "../upload/upload.service.js";
import { createLinkSchema, onboardingDetailsSchema, tokenParams } from "./onboarding.schema.js";
import { createLink, linkStatus, openForm, revokeLink, saveForm, submitForm, uploadOwnDocument } from "./onboarding.service.js";

// HR: /api/employees/:id/onboarding-link
export const onboardingLinkRoutes = Router({ mergeParams: true });
onboardingLinkRoutes.use(authenticate, scopeToCompany, requirePermission("employees.manage"));
onboardingLinkRoutes.get("/", validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await linkStatus(tenant(req).companyId, Number(req.params.id)))));
onboardingLinkRoutes.post(
  "/",
  validate({ params: idParams, body: createLinkSchema }),
  asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await createLink(tenant(req).companyId, currentUser(req), Number(req.params.id), req.body))),
);
onboardingLinkRoutes.delete(
  "/",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await revokeLink(tenant(req).companyId, currentUser(req), Number(req.params.id));
    res.json({ success: true });
  }),
);

// Employee: /api/onboarding/:token — no login, the token is the key
export const onboardingRoutes = Router();
onboardingRoutes.get("/:token", validate({ params: tokenParams }), asyncHandler(async (req, res) => res.json(await openForm(req.params.token as string))));
onboardingRoutes.put("/:token", validate({ params: tokenParams, body: onboardingDetailsSchema }), asyncHandler(async (req, res) => res.json(await saveForm(req.params.token as string, req.body))));
onboardingRoutes.post(
  "/:token/documents",
  fileUpload.single("file"),
  validate({ params: tokenParams, body: documentSchema }),
  asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await uploadOwnDocument(req.params.token as string, req.file, req.body))),
);
onboardingRoutes.post("/:token/submit", validate({ params: tokenParams }), asyncHandler(async (req, res) => res.json(await submitForm(req.params.token as string))));

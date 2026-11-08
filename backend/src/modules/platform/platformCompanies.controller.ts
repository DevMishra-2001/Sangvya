import { asyncHandler } from "../../utils/asyncHandler.js";
import { currentUser } from "../../utils/requestContext.js";
import { setCompanyModules } from "./platformModules.service.js";
import { getPlatformCompany, listPlatformCompanies, sendPasswordReset, setAdminNotes, setCompanyStatus, setSubscription, setVerification } from "./platformCompanies.service.js";

// GET /api/platform/companies
export const listCompaniesHandler = asyncHandler(async (_req, res) => {
  res.json(await listPlatformCompanies());
});

// GET /api/platform/companies/:id
export const getCompanyHandler = asyncHandler(async (req, res) => {
  res.json(await getPlatformCompany(Number(req.params.id)));
});

// PATCH /api/platform/companies/:id/verification  { status, notes? }
export const verificationHandler = asyncHandler(async (req, res) => {
  res.json(await setVerification(currentUser(req), Number(req.params.id), req.body));
});

// PATCH /api/platform/companies/:id/status  { status, reason? }
export const statusHandler = asyncHandler(async (req, res) => {
  res.json(await setCompanyStatus(currentUser(req), Number(req.params.id), req.body));
});

// PATCH /api/platform/companies/:id/modules  { modules: { payroll: false, … } }
export const modulesHandler = asyncHandler(async (req, res) => {
  res.json(await setCompanyModules(currentUser(req), Number(req.params.id), req.body));
});

// PATCH /api/platform/companies/:id/subscription  { trialEndsOn?, pricePerEmployee? }
export const subscriptionHandler = asyncHandler(async (req, res) => {
  res.json(await setSubscription(currentUser(req), Number(req.params.id), req.body));
});

// PATCH /api/platform/companies/:id/notes  { notes }
export const notesHandler = asyncHandler(async (req, res) => {
  res.json(await setAdminNotes(currentUser(req), Number(req.params.id), req.body.notes ?? null));
});

// POST /api/platform/companies/:id/password-reset  { userId }
export const passwordResetHandler = asyncHandler(async (req, res) => {
  res.json(await sendPasswordReset(currentUser(req), Number(req.params.id), req.body.userId));
});

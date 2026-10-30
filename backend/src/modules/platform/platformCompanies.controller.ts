import { asyncHandler } from "../../utils/asyncHandler.js";
import { currentUser } from "../../utils/requestContext.js";
import { setCompanyModules } from "./platformModules.service.js";
import { getPlatformCompany, listPlatformCompanies, setCompanyStatus, setVerification } from "./platformCompanies.service.js";

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

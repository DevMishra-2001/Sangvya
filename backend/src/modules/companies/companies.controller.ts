import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { NotFoundError } from "../../utils/httpErrors.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser } from "../../utils/requestContext.js";
import { me } from "../auth/auth.service.js";
import { reissueAccessToken } from "../auth/session.service.js";
import { findUserById } from "../users/users.service.js";
import { createCompanyForUser, listMyCompanies, switchCompany } from "./companies.service.js";

// The user's company changed: give the browser a token with the new company,
// and answer with the same payload as GET /auth/me
async function respondWithCurrentUser(req: Request, res: Response, status: number) {
  const auth = currentUser(req);
  const user = await findUserById(auth.id);
  if (!user) throw new NotFoundError("User not found");
  reissueAccessToken(res, user, auth.sessionId);
  res.status(status).json(await me(user.id));
}

// GET /api/companies — companies I can open
export const listCompaniesHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  res.json(await listMyCompanies(user.id, user.companyId));
});

// POST /api/companies — create a company and make it the current one
export const createCompanyHandler = asyncHandler(async (req, res) => {
  const auth = currentUser(req);
  const user = await findUserById(auth.id);
  if (!user) throw new NotFoundError("User not found");
  await createCompanyForUser(user, req.body);
  await respondWithCurrentUser(req, res, HttpStatus.CREATED);
});

// POST /api/companies/:id/switch
export const switchCompanyHandler = asyncHandler(async (req, res) => {
  await switchCompany(currentUser(req).id, Number(req.params.id));
  await respondWithCurrentUser(req, res, HttpStatus.OK);
});

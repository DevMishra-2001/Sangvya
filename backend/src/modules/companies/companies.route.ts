import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { can } from "../../utils/can.js";
import { ForbiddenError } from "../../utils/httpErrors.js";
import { validate } from "../../middlewares/validate.js";
import { createCompanyHandler, listCompaniesHandler, switchCompanyHandler } from "./companies.controller.js";
import { companyIdParams, createCompanySchema } from "./companies.schema.js";

// Anyone may create their first company (they become its Admin); more companies
// need companies.manage (an Admin owning several)
function canCreateCompany(req: Request, _res: Response, next: NextFunction) {
  const user = req.user!;
  if (!user.companyId || can(user, "companies.manage")) return next();
  next(new ForbiddenError("You can't create another company"));
}

// No scopeToCompany here: a new user has no company yet
const router = Router();
router.use(authenticate);

router.get("/", listCompaniesHandler);
router.post("/", canCreateCompany, validate({ body: createCompanySchema }), createCompanyHandler);
router.post("/:id/switch", validate({ params: companyIdParams }), switchCompanyHandler);

export const companyRoutes = router;

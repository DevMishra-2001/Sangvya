import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { globalSearchHandler } from "./search.controller.js";
import { searchQuery } from "./search.schema.js";

// Command palette search (each kind checks its own access in the service)
const router = Router();
router.use(authenticate, scopeToCompany);

router.get("/", validate({ query: searchQuery }), globalSearchHandler);

export const searchRoutes = router;

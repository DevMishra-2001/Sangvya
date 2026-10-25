import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import { createHolidayHandler, deleteHolidayHandler, listHolidaysHandler } from "./holidays.controller.js";
import { createHolidaySchema } from "./holidays.schema.js";

const router = Router();
router.use(authenticate, scopeToCompany);

router.get("/", listHolidaysHandler);
router.post("/", requirePermission("holidays.manage"), validate({ body: createHolidaySchema }), createHolidayHandler);
router.delete("/:id", requirePermission("holidays.manage"), validate({ params: idParams }), deleteHolidayHandler);

export const holidayRoutes = router;

import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import { createUserHandler, deleteUserHandler, listUsersHandler, updateUserHandler } from "./users.controller.js";
import { createUserSchema, updateUserSchema } from "./users.schema.js";

const router = Router();
router.use(authenticate, scopeToCompany, requirePermission("users.manage"));

router.get("/", listUsersHandler);
router.post("/", validate({ body: createUserSchema }), createUserHandler);
router.put("/:id", validate({ params: idParams, body: updateUserSchema }), updateUserHandler);
router.delete("/:id", validate({ params: idParams }), deleteUserHandler);

export const userRoutes = router;

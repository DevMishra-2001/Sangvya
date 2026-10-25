import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import {
  assignableHandler,
  assignedTasksHandler,
  createTaskHandler,
  deleteTaskHandler,
  myTasksHandler,
  reviewTaskHandler,
  updateProgressHandler,
} from "./tasks.controller.js";
import { createTaskSchema, reviewTaskSchema, taskProgressSchema } from "./tasks.schema.js";

const router = Router();
router.use(authenticate, scopeToCompany);

// Anyone: their own tasks + updating them
router.get("/mine", myTasksHandler);
router.patch("/:id/progress", validate({ params: idParams, body: taskProgressSchema }), updateProgressHandler);

// Assigners
router.get("/assigned", requirePermission("tasks.assign"), assignedTasksHandler);
router.get("/assignable", requirePermission("tasks.assign"), assignableHandler);
router.post("/", requirePermission("tasks.assign"), validate({ body: createTaskSchema }), createTaskHandler);
router.patch("/:id/review", requirePermission("tasks.assign"), validate({ params: idParams, body: reviewTaskSchema }), reviewTaskHandler);
router.delete("/:id", requirePermission("tasks.assign"), validate({ params: idParams }), deleteTaskHandler);

export const taskRoutes = router;

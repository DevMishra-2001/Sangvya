import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { tenant } from "../../utils/requestContext.js";
import { assignable, assignedTasks, createTask, deleteTask, myTasks, reviewTask, updateProgress } from "./tasks.service.js";

// GET /api/tasks/mine
export const myTasksHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  res.json(await myTasks(companyId, user));
});

// GET /api/tasks/assigned
export const assignedTasksHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  res.json(await assignedTasks(companyId, user));
});

// GET /api/tasks/assignable
export const assignableHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  res.json(await assignable(companyId, user));
});

// POST /api/tasks
export const createTaskHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  res.status(HttpStatus.CREATED).json(await createTask(companyId, user, req.body));
});

// PATCH /api/tasks/:id/progress  { status?, progress? }
export const updateProgressHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  res.json(await updateProgress(companyId, user, Number(req.params.id), req.body));
});

// PATCH /api/tasks/:id/review  { action }
export const reviewTaskHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  res.json(await reviewTask(companyId, user, Number(req.params.id), req.body));
});

// DELETE /api/tasks/:id
export const deleteTaskHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  await deleteTask(companyId, user, Number(req.params.id));
  res.json({ success: true });
});

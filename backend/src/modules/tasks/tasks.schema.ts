import { z } from "zod";
import { idField, oneOf, optionalIsoDate, optionalNumber, optionalText, requiredText } from "../../utils/zod.js";

export const PRIORITIES = ["low", "medium", "high"] as const;

export const createTaskSchema = z.object({
  title: requiredText("Task title is required", 200),
  description: optionalText(),
  assignedTo: idField("Choose who the task is for"),
  priority: oneOf(PRIORITIES, "Priority must be low, medium or high").default("medium"),
  dueDate: optionalIsoDate("Invalid due date"),
});

export const taskProgressSchema = z.object({
  status: oneOf(["todo", "in_progress", "done"], "Status must be todo, in_progress or done").optional(),
  progress: optionalNumber("Progress must be 0-100", { min: 0, max: 100, int: true }),
});

export const reviewTaskSchema = z.object({
  action: oneOf(["approve", "reopen"], "action must be 'approve' or 'reopen'"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type TaskProgressInput = z.infer<typeof taskProgressSchema>;
export type ReviewTaskInput = z.infer<typeof reviewTaskSchema>;

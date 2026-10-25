import { z } from "zod";
import { optionalDate, requiredId, requiredText } from "./common";

export const taskSchema = z.object({
  assignedTo: requiredId("Choose who the ticket is for"),
  title: requiredText("Ticket title is required", 200),
  description: z.string().trim(),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: optionalDate,
});

export type TaskForm = z.input<typeof taskSchema>;
export type TaskPayload = z.output<typeof taskSchema>;

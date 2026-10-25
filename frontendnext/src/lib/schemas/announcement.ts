import { z } from "zod";
import { requiredText } from "./common";

export const announcementSchema = z.object({
  title: requiredText("Title is required", 200),
  message: z.string().trim(),
});

export type AnnouncementInput = z.infer<typeof announcementSchema>;

import { z } from "zod";
import { requiredText } from "../../utils/zod.js";

export const createAnnouncementSchema = z.object({
  title: requiredText("Title is required", 200),
  message: z.string().trim().nullish(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

import { z } from "zod";

// GET /api/search?q=
export const searchQuery = z.object({
  q: z.string().trim().min(2, "Type at least 2 letters").max(60),
});
export type SearchQuery = z.infer<typeof searchQuery>;

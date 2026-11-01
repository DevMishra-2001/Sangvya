import { z } from "zod";

// ?page=2&limit=20 → numbers (bad values fall back to the defaults)
export const pageQuery = {
  page: z.coerce.number().int().min(1).catch(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).catch(20).default(20),
};

export const offsetOf = (page: number, limit: number) => (page - 1) * limit;

// What every paginated list answers with
export const pageMeta = (page: number, limit: number, total: number) => ({ page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });

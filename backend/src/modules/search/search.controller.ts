import { asyncHandler } from "../../utils/asyncHandler.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import type { SearchQuery } from "./search.schema.js";
import { globalSearch } from "./search.service.js";

// GET /api/search?q=  → { people, tickets, candidates }
export const globalSearchHandler = asyncHandler(async (req, res) => {
  const { q } = req.query as unknown as SearchQuery;
  res.json(await globalSearch(tenant(req).companyId, currentUser(req), q));
});

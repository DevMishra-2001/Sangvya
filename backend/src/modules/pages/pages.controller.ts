import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { createPage, deletePage, listPages, updatePage } from "./pages.service.js";

// GET /api/pages
export const listPagesHandler = asyncHandler(async (_req, res) => {
  res.json(await listPages());
});

// POST /api/pages
export const createPageHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await createPage(req.body));
});

// PUT /api/pages/:id
export const updatePageHandler = asyncHandler(async (req, res) => {
  res.json(await updatePage(Number(req.params.id), req.body));
});

// DELETE /api/pages/:id
export const deletePageHandler = asyncHandler(async (req, res) => {
  await deletePage(Number(req.params.id));
  res.json({ success: true });
});

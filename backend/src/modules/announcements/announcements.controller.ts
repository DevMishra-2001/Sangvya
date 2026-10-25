import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { tenant } from "../../utils/requestContext.js";
import { createAnnouncement, deleteAnnouncement, getFeed } from "./announcements.service.js";

// GET /api/announcements/feed
export const feedHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  res.json(await getFeed(companyId, user));
});

// POST /api/announcements
export const createAnnouncementHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  res.status(HttpStatus.CREATED).json(await createAnnouncement(companyId, user, req.body));
});

// DELETE /api/announcements/:id
export const deleteAnnouncementHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  await deleteAnnouncement(companyId, user, Number(req.params.id));
  res.json({ success: true });
});

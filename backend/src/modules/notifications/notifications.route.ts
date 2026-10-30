import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { currentUser } from "../../utils/requestContext.js";
import { idParams } from "../../utils/zod.js";
import { deleteNotifications, listNotifications, markAllRead, markRead, unreadCount } from "./notifications.service.js";

const listQuery = z.object({
  before: z.preprocess((v) => (v ? Number(v) : undefined), z.number().int().positive().optional()),
  limit: z.preprocess((v) => (v ? Number(v) : 20), z.number().int().min(1).max(50)),
  unread: z.preprocess((v) => v === "true" || v === "1", z.boolean()),
});
const deleteBody = z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) });

// The logged-in user's own notifications (works with or without a company)
const router = Router();
router.use(authenticate);

// GET /api/notifications?before=&limit=&unread=true
router.get(
  "/",
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    res.json(await listNotifications(currentUser(req).id, q));
  }),
);
// GET /api/notifications/unread-count — polled by the bell
router.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    res.json({ unread: await unreadCount(currentUser(req).id) });
  }),
);
router.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    res.json(await markAllRead(currentUser(req).id));
  }),
);
router.patch(
  "/:id/read",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    res.json(await markRead(currentUser(req).id, Number(req.params.id)));
  }),
);
router.post(
  "/delete",
  validate({ body: deleteBody }),
  asyncHandler(async (req, res) => {
    res.json(await deleteNotifications(currentUser(req).id, req.body.ids));
  }),
);

export const notificationRoutes = router;

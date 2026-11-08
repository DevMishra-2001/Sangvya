import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { idParams } from "../../utils/zod.js";
import {
  acknowledgeSchema,
  checkinSchema,
  cycleSchema,
  cycleStatusSchema,
  employeeIdParams,
  finalizeSchema,
  goalSchema,
  launchSchema,
  managerReviewSchema,
  reviewerSchema,
  selfReviewSchema,
} from "./performance.schema.js";
import {
  acknowledgeReview,
  addGoal,
  checkinGoal,
  createCycle,
  cycleReviews,
  deleteGoal,
  employeeReviews,
  finalizeReview,
  launchCycle,
  listCycles,
  myPerformance,
  reopenReview,
  reviewDetail,
  saveManagerReview,
  saveSelfReview,
  setCycleStatus,
  setReviewer,
  updateCycle,
  updateGoal,
} from "./performance.service.js";

const router = Router();
router.use(authenticate, scopeToCompany);

const cid = (req: Parameters<typeof tenant>[0]) => tenant(req).companyId;
const id = (req: { params: Record<string, string> }) => Number(req.params.id);
const hr = requirePermission("performance.manageCycles");
const view = requirePermission("performance.view");

// ---- Everyone: my reviews, my team's, and the review itself (access checked per review) ----
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const me = currentUser(req).employeeId;
    res.json(me ? await myPerformance(cid(req), me) : { mine: [], team: [] });
  }),
);
router.get("/reviews/:id", validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await reviewDetail(cid(req), currentUser(req), id(req)))));
router.post("/reviews/:id/goals", validate({ params: idParams, body: goalSchema }), asyncHandler(async (req, res) => res.json(await addGoal(cid(req), currentUser(req), id(req), req.body))));
router.put("/goals/:id", validate({ params: idParams, body: goalSchema }), asyncHandler(async (req, res) => res.json(await updateGoal(cid(req), currentUser(req), id(req), req.body))));
router.delete("/goals/:id", validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await deleteGoal(cid(req), currentUser(req), id(req)))));
router.post("/goals/:id/checkins", validate({ params: idParams, body: checkinSchema }), asyncHandler(async (req, res) => res.json(await checkinGoal(cid(req), currentUser(req), id(req), req.body))));
router.post("/reviews/:id/self", validate({ params: idParams, body: selfReviewSchema }), asyncHandler(async (req, res) => res.json(await saveSelfReview(cid(req), currentUser(req), id(req), req.body))));
router.post("/reviews/:id/manager", validate({ params: idParams, body: managerReviewSchema }), asyncHandler(async (req, res) => res.json(await saveManagerReview(cid(req), currentUser(req), id(req), req.body))));
router.post("/reviews/:id/acknowledge", validate({ params: idParams, body: acknowledgeSchema }), asyncHandler(async (req, res) => res.json(await acknowledgeReview(cid(req), currentUser(req), id(req), req.body.comment))));

// ---- HR ----
router.get("/cycles", view, asyncHandler(async (req, res) => res.json(await listCycles(cid(req)))));
router.post("/cycles", hr, validate({ body: cycleSchema }), asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await createCycle(cid(req), currentUser(req), req.body))));
router.put("/cycles/:id", hr, validate({ params: idParams, body: cycleSchema }), asyncHandler(async (req, res) => res.json(await updateCycle(cid(req), currentUser(req), id(req), req.body))));
router.patch("/cycles/:id/status", hr, validate({ params: idParams, body: cycleStatusSchema }), asyncHandler(async (req, res) => res.json(await setCycleStatus(cid(req), currentUser(req), id(req), req.body.status))));
router.post("/cycles/:id/launch", hr, validate({ params: idParams, body: launchSchema }), asyncHandler(async (req, res) => res.json(await launchCycle(cid(req), currentUser(req), id(req), req.body))));
router.get("/cycles/:id/reviews", view, validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await cycleReviews(cid(req), id(req)))));
router.post("/reviews/:id/finalize", hr, validate({ params: idParams, body: finalizeSchema }), asyncHandler(async (req, res) => res.json(await finalizeReview(cid(req), currentUser(req), id(req), req.body))));
router.post("/reviews/:id/reopen", hr, validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await reopenReview(cid(req), currentUser(req), id(req)))));
router.patch("/reviews/:id/reviewer", hr, validate({ params: idParams, body: reviewerSchema }), asyncHandler(async (req, res) => res.json(await setReviewer(cid(req), currentUser(req), id(req), req.body.managerId))));
router.get("/employees/:employeeId/reviews", view, validate({ params: employeeIdParams }), asyncHandler(async (req, res) => res.json(await employeeReviews(cid(req), Number(req.params.employeeId)))));

export const performanceRoutes = router;

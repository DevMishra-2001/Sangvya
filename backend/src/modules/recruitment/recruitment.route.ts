import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { users } from "../../db/schema.js";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { idParams } from "../../utils/zod.js";
import { loadBrand } from "../reports/branding.js";
import { fileUpload } from "../upload/upload.service.js";
import { offerLetterPdf } from "./offerLetter.js";
import {
  candidateListQuery,
  candidateSchema,
  candidateStageSchema,
  candidateUpdateSchema,
  feedbackSchema,
  interviewSchema,
  interviewUpdateSchema,
  jobSchema,
  jobStatusSchema,
  noteSchema,
  offerSchema,
  offerStatusSchema,
} from "./recruitment.schema.js";
import {
  addNote,
  candidateDetail,
  createCandidate,
  createJob,
  deleteCandidate,
  deleteJob,
  hireCandidate,
  listCandidates,
  listJobs,
  moveCandidate,
  myInterviews,
  offerForPdf,
  recruitmentOverview,
  resumeLink,
  saveOffer,
  scheduleInterview,
  setOfferStatus,
  submitFeedback,
  updateCandidate,
  updateInterview,
  updateJob,
  updateJobStatus,
  uploadResume,
} from "./recruitment.service.js";

const router = Router();
router.use(authenticate, scopeToCompany);

const cid = (req: Parameters<typeof tenant>[0]) => tenant(req).companyId;
const id = (req: { params: Record<string, string> }) => Number(req.params.id);
const view = requirePermission("recruitment.view");
const candidatesPerm = requirePermission("recruitment.candidates");
const manage = requirePermission("recruitment.manage");

// ---- For any interviewer (no recruitment access needed) ----
router.get(
  "/my-interviews",
  asyncHandler(async (req, res) => {
    const me = currentUser(req).employeeId;
    res.json(me ? await myInterviews(cid(req), me) : { interviews: [] });
  }),
);
router.post("/interviews/:id/feedback", validate({ params: idParams, body: feedbackSchema }), asyncHandler(async (req, res) => res.json(await submitFeedback(cid(req), currentUser(req), id(req), req.body))));

// ---- Overview ----
router.get("/overview", view, asyncHandler(async (req, res) => res.json(await recruitmentOverview(cid(req)))));

// ---- Jobs ----
router.get("/jobs", view, asyncHandler(async (req, res) => res.json(await listJobs(cid(req)))));
router.post("/jobs", manage, validate({ body: jobSchema }), asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await createJob(cid(req), currentUser(req), req.body))));
router.put("/jobs/:id", manage, validate({ params: idParams, body: jobSchema }), asyncHandler(async (req, res) => res.json(await updateJob(cid(req), currentUser(req), id(req), req.body))));
router.patch("/jobs/:id/status", manage, validate({ params: idParams, body: jobStatusSchema }), asyncHandler(async (req, res) => res.json(await updateJobStatus(cid(req), currentUser(req), id(req), req.body.status))));
router.delete(
  "/jobs/:id",
  manage,
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await deleteJob(cid(req), currentUser(req), id(req));
    res.json({ success: true });
  }),
);

// ---- Candidates ----
router.get("/candidates", view, validate({ query: candidateListQuery }), asyncHandler(async (req, res) => res.json(await listCandidates(cid(req), req.query as { jobId?: number }))));
router.post("/candidates", candidatesPerm, validate({ body: candidateSchema }), asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await createCandidate(cid(req), currentUser(req), req.body))));
router.get("/candidates/:id", view, validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await candidateDetail(cid(req), id(req)))));
router.put("/candidates/:id", candidatesPerm, validate({ params: idParams, body: candidateUpdateSchema }), asyncHandler(async (req, res) => res.json(await updateCandidate(cid(req), currentUser(req), id(req), req.body))));
router.patch("/candidates/:id/stage", candidatesPerm, validate({ params: idParams, body: candidateStageSchema }), asyncHandler(async (req, res) => res.json(await moveCandidate(cid(req), currentUser(req), id(req), req.body.stage, req.body.reason))));
router.post("/candidates/:id/notes", candidatesPerm, validate({ params: idParams, body: noteSchema }), asyncHandler(async (req, res) => res.json(await addNote(cid(req), currentUser(req), id(req), req.body.text))));
router.post("/candidates/:id/resume", candidatesPerm, fileUpload.single("file"), asyncHandler(async (req, res) => res.json(await uploadResume(cid(req), currentUser(req), Number(req.params.id), req.file))));
router.get("/candidates/:id/resume", view, validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await resumeLink(cid(req), id(req)))));
router.delete(
  "/candidates/:id",
  manage,
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await deleteCandidate(cid(req), currentUser(req), id(req));
    res.json({ success: true });
  }),
);

// ---- Interviews ----
router.post("/candidates/:id/interviews", candidatesPerm, validate({ params: idParams, body: interviewSchema }), asyncHandler(async (req, res) => res.json(await scheduleInterview(cid(req), currentUser(req), id(req), req.body))));
router.patch("/interviews/:id", candidatesPerm, validate({ params: idParams, body: interviewUpdateSchema }), asyncHandler(async (req, res) => res.json(await updateInterview(cid(req), currentUser(req), id(req), req.body))));

// ---- Offer + hire ----
router.put("/candidates/:id/offer", manage, validate({ params: idParams, body: offerSchema }), asyncHandler(async (req, res) => res.json(await saveOffer(cid(req), currentUser(req), id(req), req.body))));
router.patch("/candidates/:id/offer", manage, validate({ params: idParams, body: offerStatusSchema }), asyncHandler(async (req, res) => res.json(await setOfferStatus(cid(req), currentUser(req), id(req), req.body.status))));
router.get(
  "/candidates/:id/offer/pdf",
  view,
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const data = await offerForPdf(cid(req), id(req));
    const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, currentUser(req).id));
    const pdf = await offerLetterPdf(data, await loadBrand(cid(req)), me?.name);
    const name = `offer-letter-${data.candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${name}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(pdf);
  }),
);
router.post("/candidates/:id/hire", manage, validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await hireCandidate(cid(req), currentUser(req), id(req)))));

export const recruitmentRoutes = router;

import { Router } from "express";
import type { z } from "zod";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { idParams } from "../../utils/zod.js";
import { confirmSchema, extendSchema, listQuery, noteSchema, notConfirmedSchema, startSchema } from "./probation.schema.js";
import { addNote, confirmProbation, extendProbation, listProbations, notConfirm, probationHistory, startProbation } from "./probation.service.js";

const router = Router();
router.use(authenticate, scopeToCompany, requirePermission("probation.manage"));
const cid = (req: Parameters<typeof tenant>[0]) => tenant(req).companyId;
const id = (req: { params: Record<string, string> }) => Number(req.params.id);

router.get("/", validate({ query: listQuery }), asyncHandler(async (req, res) => res.json(await listProbations(cid(req), req.query as unknown as z.infer<typeof listQuery>))));
router.post("/", validate({ body: startSchema }), asyncHandler(async (req, res) => res.json(await startProbation(cid(req), currentUser(req), req.body))));
router.post("/:id/confirm", validate({ params: idParams, body: confirmSchema }), asyncHandler(async (req, res) => res.json(await confirmProbation(cid(req), currentUser(req), id(req), req.body))));
router.post("/:id/extend", validate({ params: idParams, body: extendSchema }), asyncHandler(async (req, res) => res.json(await extendProbation(cid(req), currentUser(req), id(req), req.body))));
router.post("/:id/not-confirmed", validate({ params: idParams, body: notConfirmedSchema }), asyncHandler(async (req, res) => res.json(await notConfirm(cid(req), currentUser(req), id(req), req.body))));
router.post("/:id/notes", validate({ params: idParams, body: noteSchema }), asyncHandler(async (req, res) => res.json(await addNote(cid(req), currentUser(req), id(req), req.body.notes))));
router.get("/:id/history", validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await probationHistory(cid(req), id(req)))));

export const probationRoutes = router;

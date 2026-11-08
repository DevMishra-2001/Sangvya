import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { idParams } from "../../utils/zod.js";
import { clearanceSchema, interviewSchema, listQuery, settlementSchema } from "./exits.schema.js";
import { completeExitRecord, exitDetail, listExits, saveInterview, saveSettlement, setClearance, settlementEstimate } from "./exits.service.js";

const router = Router();
router.use(authenticate, scopeToCompany, requirePermission("exits.manage"));
const cid = (req: Parameters<typeof tenant>[0]) => tenant(req).companyId;
const id = (req: { params: Record<string, string> }) => Number(req.params.id);
const itemParams = z.object({ id: z.coerce.number().int().positive(), key: z.string().regex(/^[a-z_]{2,30}$/) });

router.get("/", validate({ query: listQuery }), asyncHandler(async (req, res) => res.json(await listExits(cid(req), req.query as unknown as z.infer<typeof listQuery>))));
router.get("/:id/settlement-estimate", validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await settlementEstimate(cid(req), id(req)))));
router.get("/:id", validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await exitDetail(cid(req), id(req)))));
router.put("/:id/clearance/:key", validate({ params: itemParams, body: clearanceSchema }), asyncHandler(async (req, res) => res.json(await setClearance(cid(req), currentUser(req), id(req), String(req.params.key), req.body))));
router.put("/:id/settlement", validate({ params: idParams, body: settlementSchema }), asyncHandler(async (req, res) => res.json(await saveSettlement(cid(req), currentUser(req), id(req), req.body))));
router.put("/:id/interview", validate({ params: idParams, body: interviewSchema }), asyncHandler(async (req, res) => res.json(await saveInterview(cid(req), currentUser(req), id(req), req.body))));
router.post("/:id/complete", validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await completeExitRecord(cid(req), currentUser(req), id(req)))));

export const exitRoutes = router;

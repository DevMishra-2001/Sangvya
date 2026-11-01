import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { idParams } from "../../utils/zod.js";
import { assetSchema, assignManySchema, assignSchema, listQuery, returnSchema, statusSchema } from "./assets.schema.js";
import {
  assetHistory,
  assignAsset,
  assignAssets,
  availableAssets,
  createAsset,
  deleteAsset,
  employeeAssets,
  listAssets,
  returnAsset,
  setAssetStatus,
  updateAsset,
} from "./assets.service.js";

const router = Router();
router.use(authenticate, scopeToCompany);

// My own assets (anyone)
router.get("/mine", asyncHandler(async (req, res) => {
  const me = currentUser(req).employeeId;
  res.json(me ? await employeeAssets(tenant(req).companyId, me) : { current: [], past: [] });
}));

router.use(requirePermission("assets.manage"));
const cid = (req: Parameters<typeof tenant>[0]) => tenant(req).companyId;
const id = (req: { params: Record<string, string> }) => Number(req.params.id);

router.get("/", validate({ query: listQuery }), asyncHandler(async (req, res) => res.json(await listAssets(cid(req), req.query as unknown as z.infer<typeof listQuery>))));
router.get("/available", asyncHandler(async (req, res) => res.json({ assets: await availableAssets(cid(req)) })));
router.get("/employee/:id", validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await employeeAssets(cid(req), id(req)))));
router.post("/", validate({ body: assetSchema }), asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await createAsset(cid(req), currentUser(req), req.body))));
router.post("/assign", validate({ body: assignManySchema }), asyncHandler(async (req, res) => res.json(await assignAssets(cid(req), currentUser(req), req.body))));
router.put("/:id", validate({ params: idParams, body: assetSchema }), asyncHandler(async (req, res) => res.json(await updateAsset(cid(req), currentUser(req), id(req), req.body))));
router.delete("/:id", validate({ params: idParams }), asyncHandler(async (req, res) => {
  await deleteAsset(cid(req), currentUser(req), id(req));
  res.json({ success: true });
}));
router.post("/:id/assign", validate({ params: idParams, body: assignSchema }), asyncHandler(async (req, res) => res.json(await assignAsset(cid(req), currentUser(req), id(req), req.body))));
router.post("/:id/return", validate({ params: idParams, body: returnSchema }), asyncHandler(async (req, res) => res.json(await returnAsset(cid(req), currentUser(req), id(req), req.body))));
router.post("/:id/status", validate({ params: idParams, body: statusSchema }), asyncHandler(async (req, res) => res.json(await setAssetStatus(cid(req), currentUser(req), id(req), req.body))));
router.get("/:id/history", validate({ params: idParams }), asyncHandler(async (req, res) => res.json(await assetHistory(cid(req), id(req)))));

export const assetRoutes = router;

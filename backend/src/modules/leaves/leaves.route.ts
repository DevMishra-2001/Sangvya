import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import {
  allBalancesHandler,
  applyLeaveHandler,
  cancelLeaveHandler,
  decideLeaveHandler,
  getLeavePolicyHandler,
  listLeavesHandler,
  updateLeavePolicyHandler,
} from "./leaves.controller.js";
import { applyLeaveSchema, leavePolicySchema, leaveRulesSchema, leaveStatusSchema, leaveTypeSchema } from "./leaves.schema.js";
import { deleteLeaveType, leaveSettingsView, publicLeaveTypes, saveLeaveRules, saveLeaveType } from "./leaveSettings.service.js";
import { leaveFile, uploadLeaveFile } from "./leaves.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { fileUpload } from "../upload/upload.service.js";
import { z } from "zod";

// ---- /api/leaves ----
const leaves = Router();
leaves.use(authenticate, scopeToCompany);

// Everyone with the Leave module can list — the service narrows it to own leaves without "leave.viewAll"
leaves.get("/", requirePermission("leave.apply"), listLeavesHandler);
leaves.get("/balances", requirePermission("leave.viewAll"), allBalancesHandler);

// Leave types (labels + what can be applied for) — everyone
leaves.get("/types", requirePermission("leave.apply"), asyncHandler(async (req, res) => res.json(await publicLeaveTypes(tenant(req).companyId))));

// Leave Settings — types and rules (Admin / HR)
const settings = requirePermission("leave.settings");
leaves.get("/settings", settings, asyncHandler(async (req, res) => res.json(await leaveSettingsView(tenant(req).companyId))));
leaves.put("/settings/rules", settings, validate({ body: leaveRulesSchema }), asyncHandler(async (req, res) => res.json(await saveLeaveRules(tenant(req).companyId, currentUser(req), req.body))));
leaves.post("/settings/types", settings, validate({ body: leaveTypeSchema }), asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await saveLeaveType(tenant(req).companyId, currentUser(req), null, req.body))));
leaves.put("/settings/types/:id", settings, validate({ params: idParams, body: leaveTypeSchema }), asyncHandler(async (req, res) => res.json(await saveLeaveType(tenant(req).companyId, currentUser(req), Number(req.params.id), req.body))));
leaves.delete(
  "/settings/types/:id",
  settings,
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await deleteLeaveType(tenant(req).companyId, currentUser(req), Number(req.params.id));
    res.json({ success: true });
  }),
);

// Supporting documents: uploaded first, then sent with the request
leaves.post("/files", requirePermission("leave.apply"), fileUpload.single("file"), asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await uploadLeaveFile(tenant(req).companyId, currentUser(req), req.file))));
leaves.get(
  "/:id/files/:index",
  requirePermission("leave.apply"),
  validate({ params: z.object({ id: z.coerce.number().int().positive(), index: z.coerce.number().int().min(0).max(10) }) }),
  asyncHandler(async (req, res) => res.json(await leaveFile(tenant(req).companyId, currentUser(req), Number(req.params.id), Number(req.params.index)))),
);
// Own leave (pending, or approved and not started yet); HR any — checked in the service
leaves.post("/:id/cancel", requirePermission("leave.apply"), validate({ params: idParams }), cancelLeaveHandler);
leaves.post("/", requirePermission("leave.apply"), validate({ body: applyLeaveSchema }), applyLeaveHandler);
leaves.patch(
  "/:id/status",
  requirePermission("leave.approve"),
  validate({ params: idParams, body: leaveStatusSchema }),
  decideLeaveHandler,
);

// ---- /api/leave-policy ----
const policy = Router();
policy.use(authenticate, scopeToCompany);

policy.get("/", requirePermission("leave.apply"), getLeavePolicyHandler);
policy.put("/", requirePermission("leavePolicy.manage"), validate({ body: leavePolicySchema }), updateLeavePolicyHandler);

export const leaveRoutes = leaves;
export const leavePolicyRoutes = policy;

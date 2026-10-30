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
import { applyLeaveSchema, leavePolicySchema, leaveStatusSchema } from "./leaves.schema.js";

// ---- /api/leaves ----
const leaves = Router();
leaves.use(authenticate, scopeToCompany);

// Everyone with the Leave module can list — the service narrows it to own leaves without "leave.viewAll"
leaves.get("/", requirePermission("leave.apply"), listLeavesHandler);
leaves.get("/balances", requirePermission("leave.viewAll"), allBalancesHandler);
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

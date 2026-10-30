import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { tenant } from "../../utils/requestContext.js";
import { getPolicy, updatePolicy } from "./leaveBalance.service.js";
import { allBalances, applyLeave, cancelLeave, decideLeave, listLeaves } from "./leaves.service.js";

// GET /api/leaves
export const listLeavesHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  res.json(await listLeaves(companyId, user));
});

// POST /api/leaves
export const applyLeaveHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  res.status(HttpStatus.CREATED).json(await applyLeave(companyId, user, req.body));
});

// PATCH /api/leaves/:id/status  { status: "approved" | "rejected" }
export const decideLeaveHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  res.json(await decideLeave(companyId, user, Number(req.params.id), req.body));
});

// GET /api/leave-policy — the company's CL / SL / OL / EL quotas (anyone can read)
export const getLeavePolicyHandler = asyncHandler(async (req, res) => {
  res.json({ policy: await getPolicy(tenant(req).companyId) });
});

// PUT /api/leave-policy  { clPerYear, slPerYear, olPerYear, elPerMonth }
export const updateLeavePolicyHandler = asyncHandler(async (req, res) => {
  res.json({ policy: await updatePolicy(tenant(req).companyId, req.body) });
});

// POST /api/leaves/:id/cancel — withdraw / cancel (days go back to the balance)
export const cancelLeaveHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  res.json(await cancelLeave(companyId, user, Number(req.params.id)));
});

// GET /api/leaves/balances — everyone's balances (HR)
export const allBalancesHandler = asyncHandler(async (req, res) => {
  res.json(await allBalances(tenant(req).companyId));
});

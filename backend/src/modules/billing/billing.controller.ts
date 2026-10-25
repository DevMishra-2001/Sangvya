import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { tenant } from "../../utils/requestContext.js";
import { cancelSubscription, createSubscription, getBillingStatus, handleWebhook, listInvoices } from "./billing.service.js";

// GET /api/billing/status
export const billingStatusHandler = asyncHandler(async (req, res) => {
  res.json(await getBillingStatus(tenant(req).companyId));
});

// POST /api/billing/subscribe
export const subscribeHandler = asyncHandler(async (req, res) => {
  const { companyId, user } = tenant(req);
  res.status(HttpStatus.CREATED).json(await createSubscription(companyId, user.id));
});

// GET /api/billing/invoices
export const listInvoicesHandler = asyncHandler(async (req, res) => {
  res.json(await listInvoices(tenant(req).companyId));
});

// POST /api/billing/cancel
export const cancelSubscriptionHandler = asyncHandler(async (req, res) => {
  res.json(await cancelSubscription(tenant(req).companyId));
});

// POST /api/billing/webhook — body is a raw Buffer (see billing.route.ts)
export const webhookHandler = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  res.json(await handleWebhook(req.body, typeof signature === "string" ? signature : undefined));
});

import express, { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import {
  billingStatusHandler,
  cancelSubscriptionHandler,
  listInvoicesHandler,
  subscribeHandler,
  webhookHandler,
} from "./billing.controller.js";

const router = Router();

// Called by Razorpay's servers, not a logged-in browser — no auth here.
// Signature verification needs the exact raw bytes, so this route parses the
// body itself (app.ts skips express.json() for it).
router.post("/webhook", express.raw({ type: "application/json" }), webhookHandler);

// Everything else is the company's own admin managing their billing
router.use(authenticate, scopeToCompany);

router.get("/status", requirePermission("billing.view"), billingStatusHandler);
router.get("/invoices", requirePermission("billing.view"), listInvoicesHandler);
router.post("/subscribe", requirePermission("billing.manage"), subscribeHandler);
router.post("/cancel", requirePermission("billing.manage"), cancelSubscriptionHandler);

export const billingRoutes = router;

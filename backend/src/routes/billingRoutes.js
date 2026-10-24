const express = require("express");
const { authenticate, requirePermission } = require("../middleware/auth");
const { scopeToCompany } = require("../middleware/tenant");
const asyncHandler = require("../utils/asyncHandler");
const billingController = require("../controllers/billingController");

const router = express.Router();

// The webhook is called by Razorpay's servers, not a logged-in browser —
// no authenticate/scopeToCompany here. It's mounted separately in server.js
// with express.raw() so signature verification sees the exact request bytes.
router.post("/webhook", asyncHandler(billingController.handleWebhook));

// Everything else is the company's own admin managing their billing.
router.use(authenticate, scopeToCompany);

router.get("/status", requirePermission("billing.view"), asyncHandler(billingController.getStatus));
router.get("/invoices", requirePermission("billing.view"), asyncHandler(billingController.listInvoices));
router.post("/subscribe", requirePermission("billing.manage"), asyncHandler(billingController.createSubscription));
router.post("/cancel", requirePermission("billing.manage"), asyncHandler(billingController.cancelSubscription));

module.exports = router;

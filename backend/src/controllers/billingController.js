const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const SubscriptionModel = require("../models/subscriptionModel");
const InvoiceModel = require("../models/invoiceModel");
const EmployeeModel = require("../models/employeeModel");
const CompanyModel = require("../models/companyModel");
const UserModel = require("../models/userModel");
const { query } = require("../config/db");

const PRICE_PER_EMPLOYEE = Number(process.env.PRICE_PER_EMPLOYEE || 15);

// GET /api/billing/status
// Everything the Billing page needs in one call: trial/active state,
// current headcount, and what the next charge will be.
async function getStatus(req, res) {
  const sub = await SubscriptionModel.findByCompany(req.companyId);
  if (!sub) return res.status(404).json({ error: "No subscription found for this company" });

  const employees = await EmployeeModel.findAll(req.companyId);
  const quantity = employees.length;
  const monthlyAmount = quantity * Number(sub.price_per_employee);

  const now = new Date();
  const trialDaysLeft = sub.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at) - now) / 86400000))
    : 0;

  res.json({
    subscription: sub,
    employeeCount: quantity,
    pricePerEmployee: Number(sub.price_per_employee),
    monthlyAmount,
    trialDaysLeft,
    isTrialExpired: sub.status === "trial" && sub.trial_ends_at && new Date(sub.trial_ends_at) < now,
  });
}

// POST /api/billing/subscribe
// Creates (or reuses) a Razorpay customer, then creates a Razorpay
// Subscription billed at PRICE_PER_EMPLOYEE x current headcount.
// Returns the subscription id for the frontend to open Razorpay Checkout with —
// the actual "did the card succeed" answer comes later, via webhook.
async function createSubscription(req, res) {
  if (!process.env.RAZORPAY_PLAN_ID) {
    return res.status(500).json({
      error: "Billing isn't configured yet — RAZORPAY_PLAN_ID is missing. Run scripts/createRazorpayPlan.js first.",
    });
  }

  const sub = await SubscriptionModel.findByCompany(req.companyId);
  if (!sub) return res.status(404).json({ error: "No subscription record found for this company" });
  if (sub.status === "active") {
    return res.status(409).json({ error: "This company already has an active subscription" });
  }

  const employees = await EmployeeModel.findAll(req.companyId);
  const quantity = Math.max(1, employees.length); // Razorpay requires quantity >= 1

  const company = await CompanyModel.findById(req.companyId);
  const adminUser = await UserModel.findById(req.user.id);

  let razorpayCustomerId = sub.razorpay_customer_id;
  if (!razorpayCustomerId) {
    const customer = await razorpay.customers.create({
      name: company.name,
      email: adminUser.email,
      notes: { companyId: req.companyId },
    });
    razorpayCustomerId = customer.id;
  }

  // total_count = number of billing cycles Razorpay will run before the
  // subscription needs renewing. 120 monthly cycles = 10 years, effectively
  // "until cancelled" for a product at this stage.
  const razorpaySubscription = await razorpay.subscriptions.create({
    plan_id: process.env.RAZORPAY_PLAN_ID,
    customer_notify: 1,
    quantity,
    total_count: 120,
    notes: { companyId: req.companyId },
  });

  await SubscriptionModel.attachRazorpaySubscription(req.companyId, {
    razorpayCustomerId,
    razorpaySubscriptionId: razorpaySubscription.id,
    razorpayPlanId: process.env.RAZORPAY_PLAN_ID,
    quantity,
  });

  res.status(201).json({
    razorpaySubscriptionId: razorpaySubscription.id,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    quantity,
    monthlyAmount: quantity * PRICE_PER_EMPLOYEE,
  });
}

// GET /api/billing/invoices
async function listInvoices(req, res) {
  const invoices = await InvoiceModel.listForCompany(req.companyId);
  res.json({ invoices });
}

// POST /api/billing/cancel
async function cancelSubscription(req, res) {
  const sub = await SubscriptionModel.findByCompany(req.companyId);
  if (!sub || !sub.razorpay_subscription_id) {
    return res.status(404).json({ error: "No active Razorpay subscription to cancel" });
  }

  // cancel_at_cycle_end: true lets them keep access through what they already paid for.
  await razorpay.subscriptions.cancel(sub.razorpay_subscription_id, true);
  res.json({ success: true, message: "Subscription will be cancelled at the end of the current billing cycle" });
}

// ---- Webhook ----

function verifySignature(rawBody, signature) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  // timingSafeEqual needs equal-length buffers, so bail out early on mismatch
  if (expected.length !== signature?.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// POST /api/billing/webhook
// Razorpay calls this directly (not the frontend), so there's no req.user —
// everything here is keyed off the subscription/company id Razorpay sends us.
// Mounted with express.raw() in server.js because signature verification
// needs the exact raw request bytes, not the re-serialized JSON.
async function handleWebhook(req, res) {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = req.body; // Buffer, thanks to express.raw()

  if (!process.env.RAZORPAY_WEBHOOK_SECRET || !verifySignature(rawBody, signature)) {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  const event = JSON.parse(rawBody.toString("utf8"));

  // Razorpay can redeliver the same event — skip if we've already processed this id.
  const existing = await query(`SELECT id FROM webhook_events WHERE razorpay_event_id = $1`, [event.id]);
  if (existing.rows.length > 0) {
    return res.json({ received: true, duplicate: true });
  }
  await query(
    `INSERT INTO webhook_events (razorpay_event_id, event_type, payload) VALUES ($1, $2, $3)`,
    [event.id, event.event, event]
  );

  const entity = event.payload?.subscription?.entity;
  const paymentEntity = event.payload?.payment?.entity;

  switch (event.event) {
    case "subscription.activated": {
      if (entity) {
        await SubscriptionModel.updateStatusByRazorpaySubscriptionId(
          entity.id, "active", new Date(entity.current_end * 1000)
        );
      }
      break;
    }

    case "subscription.charged": {
      if (entity) {
        const sub = await SubscriptionModel.updateStatusByRazorpaySubscriptionId(
          entity.id, "active", new Date(entity.current_end * 1000)
        );
        if (sub && paymentEntity) {
          const now = new Date();
          await InvoiceModel.create({
            companyId: sub.company_id,
            razorpayPaymentId: paymentEntity.id,
            razorpayInvoiceId: event.payload?.invoice?.entity?.id || null,
            amount: paymentEntity.amount / 100, // paise -> rupees
            employeeCount: sub.quantity,
            status: "paid",
            billingMonth: now.getMonth() + 1,
            billingYear: now.getFullYear(),
          });
        }
      }
      break;
    }

    case "subscription.pending": {
      // A charge failed but Razorpay will retry — flag it without cutting access yet.
      if (entity) await SubscriptionModel.updateStatusByRazorpaySubscriptionId(entity.id, "past_due");
      break;
    }

    case "subscription.halted": {
      // Razorpay gave up retrying — treat as cancelled/blocked.
      if (entity) await SubscriptionModel.updateStatusByRazorpaySubscriptionId(entity.id, "past_due");
      break;
    }

    case "subscription.cancelled":
    case "subscription.completed": {
      if (entity) await SubscriptionModel.updateStatusByRazorpaySubscriptionId(entity.id, "cancelled");
      break;
    }

    case "payment.failed": {
      // Logged via webhook_events above for manual follow-up. Razorpay's
      // payment.failed payload doesn't reliably carry our companyId, and the
      // subscription will separately fire subscription.pending/halted, which
      // is what actually drives status changes here.
      console.warn("Razorpay payment.failed event received:", event.payload?.payment?.entity?.id);
      break;
    }

    default:
      break; // ignore events we don't act on
  }

  res.json({ received: true });
}

module.exports = { getStatus, createSubscription, listInvoices, cancelSubscription, handleWebhook };

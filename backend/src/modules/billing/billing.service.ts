import crypto from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db, type Database, type Transaction } from "../../config/db.js";
import { env } from "../../config/env.js";
import { getRazorpay } from "../../config/razorpay.js";
import { companies, invoices, subscriptions, users, webhookEvents } from "../../db/schema.js";
import { BadRequestError, ConflictError, InternalServerError, NotFoundError } from "../../utils/httpErrors.js";
import { countEmployees } from "../employees/employees.service.js";

type Subscription = typeof subscriptions.$inferSelect;

// ---- Subscription rows ----

// Called once, right after a company signs up — starts them on a free trial.
export async function createTrialSubscription(companyId: number, trialDays: number, executor: Database | Transaction = db) {
  const [sub] = await executor
    .insert(subscriptions)
    .values({
      company_id: companyId,
      status: "trial",
      trial_ends_at: sql`now() + make_interval(days => ${trialDays})`,
    })
    .returning();
  return sub;
}

async function findSubscription(companyId: number): Promise<Subscription | undefined> {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.company_id, companyId));
  return sub;
}

async function updateStatusByRazorpayId(razorpaySubscriptionId: string, status: string, currentPeriodEnd?: Date) {
  const [sub] = await db
    .update(subscriptions)
    .set({
      status,
      ...(currentPeriodEnd ? { current_period_end: currentPeriodEnd } : {}),
      updated_at: sql`now()`,
    })
    .where(eq(subscriptions.razorpay_subscription_id, razorpaySubscriptionId))
    .returning();
  return sub;
}

// Keeps billing in step with headcount. Called after any employee is added or
// removed. Always updates our own `quantity` (so the Billing page shows the right
// number even during the trial). If the company has a live Razorpay subscription,
// the new quantity is pushed there too so the *next* charge reflects it.
export async function syncSubscriptionQuantity(companyId: number) {
  const quantity = await countEmployees(companyId);
  const [sub] = await db
    .update(subscriptions)
    .set({ quantity, updated_at: sql`now()` })
    .where(eq(subscriptions.company_id, companyId))
    .returning();
  if (!sub) return null; // no subscription row (shouldn't happen post-signup, but don't crash)

  if (sub.razorpay_subscription_id && sub.status === "active") {
    try {
      await getRazorpay().subscriptions.update(sub.razorpay_subscription_id, {
        quantity,
        schedule_change_at: "cycle_end", // avoid surprise mid-cycle charges
      });
    } catch (err) {
      // Don't fail the employee create/delete because Razorpay had a hiccup —
      // log it so it can be reconciled manually.
      const e = err as { error?: unknown; message?: string };
      console.error(`Failed to sync Razorpay quantity for company ${companyId}:`, e.error || e.message);
    }
  }
  return sub;
}

// ---- Billing page ----

// Everything the Billing page needs in one call: trial/active state,
// current headcount, and what the next charge will be.
export async function getBillingStatus(companyId: number) {
  const sub = await findSubscription(companyId);
  if (!sub) throw new NotFoundError("No subscription found for this company");

  const employeeCount = await countEmployees(companyId);
  const now = new Date();
  const trialEnds = sub.trial_ends_at;
  return {
    subscription: sub,
    employeeCount,
    pricePerEmployee: Number(sub.price_per_employee),
    monthlyAmount: employeeCount * Number(sub.price_per_employee),
    trialDaysLeft: trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / 86400000)) : 0,
    isTrialExpired: sub.status === "trial" && Boolean(trialEnds) && trialEnds! < now,
  };
}

// Creates (or reuses) a Razorpay customer, then a Razorpay Subscription billed at
// PRICE_PER_EMPLOYEE x current headcount. Returns the subscription id for the
// frontend to open Razorpay Checkout with — "did the card succeed" comes later via webhook.
export async function createSubscription(companyId: number, userId: number) {
  if (!env.RAZORPAY_PLAN_ID) {
    throw new InternalServerError("Billing isn't configured yet — RAZORPAY_PLAN_ID is missing. Run scripts/createRazorpayPlan.ts first.");
  }
  const sub = await findSubscription(companyId);
  if (!sub) throw new NotFoundError("No subscription record found for this company");
  if (sub.status === "active") throw new ConflictError("This company already has an active subscription");

  const quantity = Math.max(1, await countEmployees(companyId)); // Razorpay requires quantity >= 1
  const razorpay = getRazorpay();

  let razorpayCustomerId = sub.razorpay_customer_id;
  if (!razorpayCustomerId) {
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId));
    const [admin] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    const customer = await razorpay.customers.create({
      name: company.name,
      email: admin.email,
      notes: { companyId: String(companyId) },
    });
    razorpayCustomerId = customer.id;
  }

  // total_count = billing cycles before renewal: 120 monthly = 10 years, effectively "until cancelled"
  const razorpaySubscription = await razorpay.subscriptions.create({
    plan_id: env.RAZORPAY_PLAN_ID,
    customer_notify: 1,
    quantity,
    total_count: 120,
    notes: { companyId: String(companyId) },
  });

  await db
    .update(subscriptions)
    .set({
      razorpay_customer_id: razorpayCustomerId,
      razorpay_subscription_id: razorpaySubscription.id,
      razorpay_plan_id: env.RAZORPAY_PLAN_ID,
      quantity,
      updated_at: sql`now()`,
    })
    .where(eq(subscriptions.company_id, companyId));

  return {
    razorpaySubscriptionId: razorpaySubscription.id,
    razorpayKeyId: env.RAZORPAY_KEY_ID,
    quantity,
    monthlyAmount: quantity * env.PRICE_PER_EMPLOYEE,
  };
}

export async function listInvoices(companyId: number) {
  const rows = await db.select().from(invoices).where(eq(invoices.company_id, companyId)).orderBy(desc(invoices.created_at));
  return { invoices: rows };
}

export async function cancelSubscription(companyId: number) {
  const sub = await findSubscription(companyId);
  if (!sub?.razorpay_subscription_id) throw new NotFoundError("No active Razorpay subscription to cancel");

  // cancel_at_cycle_end: true lets them keep access through what they already paid for
  await getRazorpay().subscriptions.cancel(sub.razorpay_subscription_id, true);
  return { success: true, message: "Subscription will be cancelled at the end of the current billing cycle" };
}

// ---- Webhook ----

function verifySignature(rawBody: Buffer, signature: string | undefined) {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const expected = crypto.createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  // timingSafeEqual needs equal-length buffers, so bail out early on mismatch
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

interface RazorpayEvent {
  id: string;
  event: string;
  payload?: {
    subscription?: { entity?: { id: string; current_end: number } };
    payment?: { entity?: { id: string; amount: number } };
    invoice?: { entity?: { id: string } };
  };
}

// Razorpay calls this directly (not the frontend), so there's no logged-in user —
// everything is keyed off the subscription id Razorpay sends. The route uses
// express.raw() because signature verification needs the exact request bytes.
export async function handleWebhook(rawBody: Buffer, signature: string | undefined) {
  if (!Buffer.isBuffer(rawBody) || !verifySignature(rawBody, signature)) {
    throw new BadRequestError("Invalid webhook signature");
  }
  const event = JSON.parse(rawBody.toString("utf8")) as RazorpayEvent;

  // Razorpay can redeliver the same event — skip if we've already processed this id
  const inserted = await db
    .insert(webhookEvents)
    .values({ razorpay_event_id: event.id, event_type: event.event, payload: event })
    .onConflictDoNothing({ target: webhookEvents.razorpay_event_id })
    .returning({ id: webhookEvents.id });
  if (inserted.length === 0) return { received: true, duplicate: true };

  const entity = event.payload?.subscription?.entity;
  const payment = event.payload?.payment?.entity;
  const periodEnd = entity ? new Date(entity.current_end * 1000) : undefined;

  switch (event.event) {
    case "subscription.activated":
      if (entity) await updateStatusByRazorpayId(entity.id, "active", periodEnd);
      break;

    case "subscription.charged":
      if (entity) {
        const sub = await updateStatusByRazorpayId(entity.id, "active", periodEnd);
        if (sub && payment) {
          const now = new Date();
          await db.insert(invoices).values({
            company_id: sub.company_id,
            razorpay_payment_id: payment.id,
            razorpay_invoice_id: event.payload?.invoice?.entity?.id ?? null,
            amount: String(payment.amount / 100), // paise -> rupees
            employee_count: sub.quantity,
            status: "paid",
            billing_month: now.getMonth() + 1,
            billing_year: now.getFullYear(),
          });
        }
      }
      break;

    // A charge failed but Razorpay will retry (pending), or gave up (halted)
    case "subscription.pending":
    case "subscription.halted":
      if (entity) await updateStatusByRazorpayId(entity.id, "past_due");
      break;

    case "subscription.cancelled":
    case "subscription.completed":
      if (entity) await updateStatusByRazorpayId(entity.id, "cancelled");
      break;

    case "payment.failed":
      // Logged in webhook_events for follow-up. The subscription separately fires
      // subscription.pending/halted, which is what drives status changes.
      console.warn("Razorpay payment.failed event received:", payment?.id);
      break;

    default:
      break; // ignore events we don't act on
  }
  return { received: true };
}

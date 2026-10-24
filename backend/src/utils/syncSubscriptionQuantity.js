const razorpay = require("../config/razorpay");
const SubscriptionModel = require("../models/subscriptionModel");
const EmployeeModel = require("../models/employeeModel");

// Keeps billing in step with headcount. Called after any employee is added
// or removed. Always updates our own `quantity` column (so the Billing page
// shows the right number even during the trial, before Razorpay is involved).
// If the company already has a live Razorpay subscription, it also pushes
// the new quantity to Razorpay so the *next* charge reflects the new count —
// Razorpay does not retroactively adjust the current cycle's charge.
async function syncSubscriptionQuantity(companyId) {
  const employees = await EmployeeModel.findAll(companyId);
  const quantity = employees.length;

  const sub = await SubscriptionModel.updateQuantity(companyId, quantity);
  if (!sub) return null; // no subscription row (shouldn't happen post-signup, but don't crash)

  if (sub.razorpay_subscription_id && sub.status === "active") {
    try {
      await razorpay.subscriptions.update(sub.razorpay_subscription_id, {
        quantity,
        schedule_change_at: "cycle_end", // avoid surprise mid-cycle charges
      });
    } catch (err) {
      // Don't fail the employee create/delete request just because Razorpay's
      // API had a hiccup — log it so it can be reconciled manually if needed.
      console.error(`Failed to sync Razorpay quantity for company ${companyId}:`, err.error || err.message);
    }
  }

  return sub;
}

module.exports = { syncSubscriptionQuantity };

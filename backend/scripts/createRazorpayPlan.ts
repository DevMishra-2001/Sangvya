// Run once, manually: npm run setup-billing
//
// Creates the single Razorpay Plan this whole product bills against:
// ₹PRICE_PER_EMPLOYEE per "unit", billed monthly. Every company's subscription
// uses this same plan with `quantity` set to their employee count — Razorpay
// multiplies amount x quantity, so 50 employees at ₹15 = ₹750/month.
//
// Afterwards, copy the printed Plan ID into backend/.env as RAZORPAY_PLAN_ID.
// You only ever need one plan for this pricing model.
import { env } from "../src/config/env.js";
import { getRazorpay } from "../src/config/razorpay.js";

async function run() {
  const price = env.PRICE_PER_EMPLOYEE;
  const plan = await getRazorpay().plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: `Sangvya — per employee (₹${price}/employee/month)`,
      amount: Math.round(price * 100), // Razorpay wants paise
      currency: "INR",
      description: "Per-employee monthly Sangvya subscription",
    },
  });

  console.log("\nPlan created successfully.\n");
  console.log("Plan ID:", plan.id);
  console.log("\nAdd this to backend/.env:");
  console.log(`RAZORPAY_PLAN_ID=${plan.id}\n`);
}

run().catch((err) => {
  console.error("Failed to create plan:", err.error || err);
  process.exit(1);
});

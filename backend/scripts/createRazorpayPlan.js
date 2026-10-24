// Run once, manually: node scripts/createRazorpayPlan.js
//
// Creates the single Razorpay Plan this whole product bills against:
// ₹15 per "unit", billed monthly. Every company's subscription then uses
// this same plan with `quantity` set to their employee count — Razorpay
// multiplies amount x quantity automatically, so 50 employees = ₹750/month.
//
// After running this, copy the printed Plan ID into backend/.env as
// RAZORPAY_PLAN_ID. You only ever need one plan for this pricing model —
// do not create a new plan per company.
require("dotenv").config();
const razorpay = require("../src/config/razorpay");

const pricePerEmployee = Number(process.env.PRICE_PER_EMPLOYEE || 15);

async function run() {
  const plan = await razorpay.plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: `Sangvya — per employee (₹${pricePerEmployee}/employee/month)`,
      amount: Math.round(pricePerEmployee * 100), // Razorpay wants paise
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

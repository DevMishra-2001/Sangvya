const Razorpay = require("razorpay");
require("dotenv").config();

// Single shared Razorpay client, reused across the billing controller.
// Test-mode keys (rzp_test_...) work exactly like live keys during development —
// switch to live keys only when ready to actually charge customers.
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = razorpay;

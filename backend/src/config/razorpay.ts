import Razorpay from "razorpay";
import { env } from "./env.js";
import { InternalServerError } from "../utils/httpErrors.js";

// Single shared Razorpay client. Created on first use so the rest of the app
// runs without billing keys (e.g. local dev). Test-mode keys (rzp_test_...)
// work exactly like live keys during development.
let client: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new InternalServerError("Billing isn't configured yet — RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing.");
  }
  client ??= new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return client;
}

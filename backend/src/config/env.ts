import * as dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// Numeric settings arrive as strings from .env — parse them with a default.
const num = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : Number(v)))
    .pipe(z.number().finite());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: num(5000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  FRONTEND_URL: z.string().optional(),
  // Proxy hops in front of this server (Next.js frontend, load balancer…).
  // Needed so rate limits see each visitor's IP; 0 when clients connect directly.
  TRUST_PROXY: num(0),

  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  // Login sessions: short access token + rotating refresh token
  ACCESS_TOKEN_TTL_MIN: num(5),
  SESSION_IDLE_MIN: num(20),
  SESSION_MAX_HOURS: num(12),
  // Strict blocks CSRF; set "none" (HTTPS only) if frontend and API are on different sites
  COOKIE_SAMESITE: z.enum(["strict", "lax", "none"]).default("strict"),

  // Razorpay — optional so the rest of the app runs without billing configured
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_PLAN_ID: z.string().optional(),

  PRICE_PER_EMPLOYEE: num(15),
  TRIAL_DAYS: num(14),

  // Attendance rules
  APP_TIMEZONE: z.string().default("Asia/Kolkata"),
  REQUIRED_WORK_HOURS: num(9),
  MAX_BREAK_MINUTES: num(60),
  COMP_OFF_VALID_DAYS: num(90),

  // ImageKit (image uploads: company logos, check-in photos). Uploads are off until set.
  IMAGEKIT_PUBLIC_KEY: z.string().optional(),
  IMAGEKIT_PRIVATE_KEY: z.string().optional(),
  IMAGEKIT_URL_ENDPOINT: z.string().optional(),
  // Top-level ImageKit folder for this app's files
  IMAGEKIT_FOLDER: z.string().default("/sangvya"),

  // Email. Without SMTP_HOST emails are printed to the console instead.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: num(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.errors.map((e) => `  ${e.path.join(".")}: ${e.message}`).join("\n");
  console.error(`Invalid environment configuration:\n${problems}`);
  process.exit(1);
}

export const env = parsed.data;

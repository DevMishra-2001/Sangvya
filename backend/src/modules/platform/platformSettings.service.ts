// Platform settings the Super Admin edits (price, trial, link expiry, banner …). Stored as one JSON row,
// cached in memory and refreshed every minute so several servers pick up a change quickly.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { MODULE_KEYS, MODULES } from "../../config/modules.js";
import { platformSettings } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";

const text = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max));

export const settingsSchema = z.object({
  pricePerEmployee: z.coerce.number().min(0, "Price can't be negative").max(100000),
  trialDays: z.coerce.number().int().min(0).max(365, "At most 365 days"),
  razorpayPlanId: text(60),
  newCompanyModules: z.array(z.string()).refine((m) => m.every((k) => MODULE_KEYS.includes(k)), "Unknown module"),
  inviteLinkHours: z.coerce.number().int().min(1).max(720, "At most 30 days"),
  sessionIdleMinutes: z.coerce.number().int().min(5, "At least 5 minutes").max(480),
  sessionMaxHours: z.coerce.number().int().min(1).max(72),
  supportEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  supportPhone: text(30),
  bannerEnabled: z.boolean(),
  bannerText: text(300),
  bannerTone: z.enum(["info", "warning", "danger"]),
});
export type PlatformSettings = z.infer<typeof settingsSchema>;

// What the code used before these were editable
const DEFAULTS: PlatformSettings = {
  pricePerEmployee: env.PRICE_PER_EMPLOYEE,
  trialDays: env.TRIAL_DAYS,
  razorpayPlanId: env.RAZORPAY_PLAN_ID ?? "",
  newCompanyModules: [...MODULE_KEYS],
  inviteLinkHours: env.INVITE_TTL_HOURS,
  sessionIdleMinutes: env.SESSION_IDLE_MIN,
  sessionMaxHours: env.SESSION_MAX_HOURS,
  supportEmail: "",
  supportPhone: "",
  bannerEnabled: false,
  bannerText: "",
  bannerTone: "info",
};

const REFRESH_MS = 60_000;
let cache: PlatformSettings = DEFAULTS;
let loadedAt = 0;
let loading: Promise<void> | null = null;

// Saved values over the defaults; a key that no longer validates falls back to its default
function merge(data: unknown): PlatformSettings {
  const saved = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const out = { ...DEFAULTS } as Record<string, unknown>;
  for (const key of Object.keys(DEFAULTS) as (keyof PlatformSettings)[]) {
    if (!(key in saved)) continue;
    const ok = settingsSchema.shape[key].safeParse(saved[key]);
    if (ok.success) out[key] = ok.data;
  }
  return out as PlatformSettings;
}

export async function loadPlatformSettings() {
  const [row] = await db.select({ data: platformSettings.data }).from(platformSettings).where(eq(platformSettings.id, 1));
  cache = merge(row?.data);
  loadedAt = Date.now();
}

// Current settings (sync). A stale cache refreshes in the background.
export function platform(): PlatformSettings {
  if (Date.now() - loadedAt > REFRESH_MS && !loading) {
    loading = loadPlatformSettings()
      .catch((err) => console.error("Platform settings refresh failed:", (err as Error).message))
      .finally(() => (loading = null));
  }
  return cache;
}

// For the Super Admin page (fresh from the database)
export async function getPlatformSettings() {
  await loadPlatformSettings();
  const [row] = await db.select({ updated_at: platformSettings.updated_at }).from(platformSettings).where(eq(platformSettings.id, 1));
  return { settings: cache, defaults: DEFAULTS, updatedAt: row?.updated_at ?? null, modules: MODULES.map(({ key, name }) => ({ key, name })) };
}

export async function savePlatformSettings(actor: Express.AuthUser, input: PlatformSettings) {
  const before = cache;
  await db
    .insert(platformSettings)
    .values({ id: 1, data: input, updated_by: actor.id, updated_at: new Date() })
    .onConflictDoUpdate({ target: platformSettings.id, set: { data: input, updated_by: actor.id, updated_at: new Date() } });
  cache = merge(input);
  loadedAt = Date.now();
  const changed = (Object.keys(input) as (keyof PlatformSettings)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(input[k]));
  if (changed.length) audit(actor, { action: "platform.settings", summary: `Changed platform settings: ${changed.join(", ")}`, meta: { changed } });
  return getPlatformSettings();
}

// What every logged-in user gets with /auth/me (banner + support contact)
export function publicPlatformInfo() {
  const s = platform();
  return {
    banner: s.bannerEnabled && s.bannerText ? { text: s.bannerText, tone: s.bannerTone } : null,
    supportEmail: s.supportEmail || null,
    supportPhone: s.supportPhone || null,
  };
}

// A company's look for PDFs: its details, report settings and logo (PNG)
import { eq, sql } from "drizzle-orm";
import { env } from "../../config/env.js";
import { db } from "../../config/db.js";
import { companies, reportSettings } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import type { ReportSettingsInput } from "./reports.schema.js";

export interface Brand {
  settings: {
    letterhead: boolean;
    showLogo: boolean;
    showAddress: boolean;
    showContact: boolean;
    showTaxIds: boolean;
    footerText: string | null;
    watermark: string | null;
    signatureLabel: string | null;
    showGenerated: boolean;
  };
  company: {
    name: string;
    legalName: string | null;
    address: string | null; // one line
    contact: string | null; // email · phone · website
    taxIds: string | null; // GSTIN · PAN
  };
  logo: Buffer | null;
}

export async function getReportSettings(companyId: number): Promise<Brand["settings"]> {
  const [r] = await db
    .insert(reportSettings)
    .values({ company_id: companyId })
    .onConflictDoUpdate({ target: reportSettings.company_id, set: { company_id: sql`excluded.company_id` } })
    .returning();
  return {
    letterhead: r.letterhead,
    showLogo: r.show_logo,
    showAddress: r.show_address,
    showContact: r.show_contact,
    showTaxIds: r.show_tax_ids,
    footerText: r.footer_text,
    watermark: r.watermark,
    signatureLabel: r.signature_label,
    showGenerated: r.show_generated,
  };
}

export async function updateReportSettings(companyId: number, actor: Express.AuthUser, s: ReportSettingsInput) {
  await getReportSettings(companyId);
  await db
    .update(reportSettings)
    .set({
      letterhead: s.letterhead,
      show_logo: s.showLogo,
      show_address: s.showAddress,
      show_contact: s.showContact,
      show_tax_ids: s.showTaxIds,
      footer_text: s.footerText ?? null,
      watermark: s.watermark ?? null,
      signature_label: s.signatureLabel ?? null,
      show_generated: s.showGenerated,
      updated_at: sql`now()`,
    })
    .where(eq(reportSettings.company_id, companyId));
  audit(actor, { companyId, action: "reports.settings_updated", summary: "Updated the report & PDF settings" });
  return { settings: await getReportSettings(companyId) };
}

// Logos are cached for a while so every PDF doesn't refetch them
const logoCache = new Map<string, { at: number; data: Buffer | null }>();
const LOGO_TTL_MS = 10 * 60 * 1000;

async function fetchLogo(url: string): Promise<Buffer | null> {
  const hit = logoCache.get(url);
  if (hit && Date.now() - hit.at < LOGO_TTL_MS) return hit.data;
  let data: Buffer | null = null;
  try {
    // pdfkit only takes PNG/JPEG; ImageKit converts on the fly
    const isImageKit = (env.IMAGEKIT_URL_ENDPOINT && url.startsWith(env.IMAGEKIT_URL_ENDPOINT)) || url.includes("ik.imagekit.io");
    const src = isImageKit ? `${url}${url.includes("?") ? "&" : "?"}tr=f-png,h-160` : url;
    const res = await fetch(src, { signal: AbortSignal.timeout(4000) });
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && /image\/(png|jpe?g)/.test(type)) data = Buffer.from(await res.arrayBuffer());
  } catch {
    data = null; // no logo rather than no PDF
  }
  logoCache.set(url, { at: Date.now(), data });
  return data;
}

export async function loadBrand(companyId: number): Promise<Brand> {
  const [settings, [c]] = await Promise.all([getReportSettings(companyId), db.select().from(companies).where(eq(companies.id, companyId))]);
  const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(", ") || null;
  return {
    settings,
    company: {
      name: c?.name ?? "",
      legalName: c?.legal_name && c.legal_name !== c.name ? c.legal_name : null,
      address: join(c?.address, c?.city, c?.state && c?.postal_code ? `${c.state} ${c.postal_code}` : (c?.state ?? c?.postal_code), c?.country),
      contact: [c?.email, c?.phone, c?.website?.replace(/^https?:\/\//, "")].filter(Boolean).join("  ·  ") || null,
      taxIds: [c?.gstin && `GSTIN ${c.gstin}`, c?.pan && `PAN ${c.pan}`].filter(Boolean).join("  ·  ") || null,
    },
    logo: settings.letterhead && settings.showLogo && c?.logo_url ? await fetchLogo(c.logo_url) : null,
  };
}

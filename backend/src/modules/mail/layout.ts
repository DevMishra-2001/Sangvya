// The shared look of every email: brand header, heading, paragraphs, an optional details table and button, and a footer.
import { env } from "../../config/env.js";

export interface EmailContent {
  subject: string;
  preheader?: string; // the grey preview line in the inbox
  heading: string;
  paragraphs: string[];
  details?: [label: string, value: string][];
  button?: { label: string; url: string };
  footnote?: string;
}

const BRAND = "Workkind";
const BLUE = "#2563EB";

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// App links in emails are absolute (FRONTEND_URL + path)
export const appUrl = (path = "/") => `${(env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

export function render(c: EmailContent): { subject: string; html: string; text: string } {
  const e = escapeHtml;
  const details = c.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border-collapse:collapse;background:#F8FAFC;border-radius:8px">${c.details
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 12px;color:#64748B;font-size:13px;width:40%">${e(k)}</td><td style="padding:8px 12px;color:#0F172A;font-size:13px;font-weight:600">${e(v)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const button = c.button
    ? `<p style="margin:24px 0"><a href="${e(c.button.url)}" style="display:inline-block;background:${BLUE};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">${e(c.button.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${e(c.preheader ?? c.paragraphs[0] ?? "")}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:20px 28px;border-bottom:1px solid #E2E8F0"><span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:${BLUE};color:#fff;text-align:center;line-height:28px;font-weight:700">W</span>
<span style="margin-left:8px;font-size:17px;font-weight:800;color:#1E293B;vertical-align:middle">${BRAND}</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#0F172A">${e(c.heading)}</h1>
${c.paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#334155">${e(p)}</p>`).join("")}
${details}${button}
${c.footnote ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#64748B">${e(c.footnote)}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;background:#F8FAFC;font-size:12px;color:#94A3B8">You're getting this because you use ${BRAND}. Notifications also appear under the bell in the app.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    c.heading,
    "",
    ...c.paragraphs,
    ...(c.details?.length ? ["", ...c.details.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(c.button ? ["", `${c.button.label}: ${c.button.url}`] : []),
    ...(c.footnote ? ["", c.footnote] : []),
    "",
    `— ${BRAND}`,
  ].join("\n");
  return { subject: c.subject, html, text };
}

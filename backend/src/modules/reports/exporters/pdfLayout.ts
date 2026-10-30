// Shared A4 page for every PDF: letterhead, page header, footer, watermark, signature
import PDFDocument from "pdfkit";
import type { Brand } from "../branding.js";

export const INK = "#0F172A";
export const MUTED = "#64748B";
export const LINE = "#E2E8F0";
export const ACCENT = "#2563EB";
const MARGIN = { top: 36, bottom: 50, left: 36, right: 36 };

export interface PdfPage {
  doc: PDFKit.PDFDocument;
  left: number;
  width: number; // usable
  bottom: () => number; // last y before the footer
  newPage: () => void; // adds a page with the small running header
  finish: () => Promise<Buffer>;
}

// Opens an A4 document and draws the letterhead + title; finish() adds footers and returns the file
export function openPdf(brand: Brand, opts: { title: string; subtitle?: string; landscape?: boolean; printedBy?: string }): PdfPage {
  const doc = new PDFDocument({ size: "A4", layout: opts.landscape ? "landscape" : "portrait", margins: { ...MARGIN }, bufferPages: true, info: { Title: opts.title, Author: brand.company.name } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const left = MARGIN.left;
  const width = doc.page.width - MARGIN.left - MARGIN.right;
  const s = brand.settings;

  // ---- First page: letterhead ----
  let y = MARGIN.top;
  if (s.letterhead) {
    let textX = left;
    if (brand.logo) {
      try {
        doc.image(brand.logo, left, y, { fit: [52, 52] });
        textX = left + 64;
      } catch {
        // unreadable image — letterhead without it
      }
    }
    doc.font("Helvetica-Bold").fontSize(15).fillColor(INK).text(brand.company.name, textX, y, { width: width - (textX - left) });
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
    const lines = [
      brand.company.legalName,
      s.showAddress ? brand.company.address : null,
      s.showContact ? brand.company.contact : null,
      s.showTaxIds ? brand.company.taxIds : null,
    ].filter(Boolean) as string[];
    for (const line of lines) doc.text(line, textX, doc.y + 1, { width: width - (textX - left) });
    y = Math.max(doc.y, brand.logo ? y + 52 : doc.y) + 10;
    doc.moveTo(left, y).lineTo(left + width, y).lineWidth(1.5).strokeColor(ACCENT).stroke();
    y += 14;
  }
  doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text(opts.title, left, y, { width });
  if (opts.subtitle) doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(opts.subtitle, left, doc.y + 2, { width });
  doc.y += 12;

  const runningHeader = () => {
    const top = MARGIN.top - 14;
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    doc.text(brand.company.name, left, top, { width: width / 2, lineBreak: false });
    doc.text(opts.title, left + width / 2, top, { width: width / 2, align: "right", lineBreak: false });
    doc.moveTo(left, top + 11).lineTo(left + width, top + 11).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.y = MARGIN.top + 6;
  };

  return {
    doc,
    left,
    width,
    bottom: () => doc.page.height - MARGIN.bottom - 6,
    newPage: () => {
      doc.addPage();
      runningHeader();
    },
    finish: async () => {
      // Signature line after the content
      if (s.signatureLabel) {
        if (doc.y + 60 > doc.page.height - MARGIN.bottom) {
          doc.addPage();
          runningHeader();
        }
        const sy = doc.y + 40;
        const sx = left + width - 170;
        doc.moveTo(sx, sy).lineTo(left + width, sy).lineWidth(0.7).strokeColor(INK).stroke();
        doc.font("Helvetica").fontSize(8.5).fillColor(INK).text(s.signatureLabel, sx, sy + 4, { width: 170, align: "center" });
      }
      const range = doc.bufferedPageRange();
      const at = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const stamp = `${opts.printedBy ? `Printed by ${opts.printedBy}  ·  ` : ""}Printed at ${at}`;
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const ph = doc.page.height;
        const pw = doc.page.width;
        // Watermark (light, diagonal, behind nothing important)
        if (s.watermark) {
          doc.save();
          doc.rotate(-30, { origin: [pw / 2, ph / 2] });
          doc.font("Helvetica-Bold").fontSize(64).fillColor("#94A3B8").fillOpacity(0.13);
          doc.text(s.watermark.toUpperCase(), 0, ph / 2 - 32, { width: pw, align: "center", lineBreak: false });
          doc.restore();
          doc.fillOpacity(1);
        }
        // Footer (below the bottom margin, so lift it while drawing or pdfkit adds a page)
        doc.page.margins.bottom = 0;
        const fy = ph - MARGIN.bottom + 14;
        doc.moveTo(left, fy - 6).lineTo(left + width, fy - 6).lineWidth(0.5).strokeColor(LINE).stroke();
        doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
        // footer text | printed by / at | page — 32% / 52% / 16%
        doc.text(s.footerText ?? brand.company.name, left, fy, { width: width * 0.32, lineBreak: false, ellipsis: true });
        if (s.showGenerated) doc.text(stamp, left + width * 0.32, fy, { width: width * 0.52, align: "center", lineBreak: false });
        doc.text(`Page ${i + 1} of ${range.count}`, left + width * 0.84, fy, { width: width * 0.16, align: "right", lineBreak: false });
        doc.page.margins.bottom = MARGIN.bottom;
      }
      doc.end();
      return done;
    },
  };
}

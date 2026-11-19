// Prints a letter: the rich-text body (pdfkit) on A4 pages with the letterhead on every page —
// the company letterhead (logo, name, address) drawn here, or the company's own PDF / image laid behind (pdf-lib).
// Sizes here match the template editor's page, so where a page ends in the editor is where it ends here.
import PDFDocument from "pdfkit";
import { PDFDocument as PdfLib, degrees, rgb } from "pdf-lib";
import { getImageKit } from "../../config/imagekit.js";
import type { LetterDoc, LetterheadMode, LetterSnapshot } from "../../db/schema.js";
import type { Brand } from "../reports/branding.js";
import { VARIABLES, type SalaryRow } from "./placeholders.js";

const INK = "#0F172A";
const MUTED = "#64748B";
const LINE = "#CBD5E1";
const ACCENT = "#2563EB";
const LINK = "#1D4ED8";
const LABEL = new Map(VARIABLES.map((v) => [v.key, v.label]));

// ---- Layout (points) — the editor uses the same numbers ----
const BODY = 10.5;
const LINE_GAP = 2.5;
const HELVETICA_LINE = 1.156; // Helvetica line height per point of font size
export const lineHeight = (size: number, gap = LINE_GAP) => size * HELVETICA_LINE + gap;
const AFTER_PARA = 0.55; // × line height (no gap)
const AFTER_HEADING = 0.7;
const HEADING_SIZE: Record<number, number> = { 1: 16, 2: 13.5, 3: 12 };
const LIST_INDENT = 22;
const AFTER_LIST = 2.4;
const HR_SPACE = { before: 4, after: 6 };
const CELL = { size: 10, gap: 2, pad: 5 };
const AFTER_TABLE = 8;
const SALARY_ROW = 18;
const KEEP_WITH_NEXT = 30; // a heading isn't left alone at the bottom of a page

// ---- Private files (letterhead, signature) with a short cache ----
const fileCache = new Map<string, { at: number; data: Buffer }>();
export async function fetchPrivateFile(path: string | null, raw?: string): Promise<Buffer | null> {
  if (!path) return null;
  const cacheKey = `${path}|${raw ?? ""}`;
  const hit = fileCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.data;
  try {
    const url = getImageKit().url({ path, signed: true, expireSeconds: 120, ...(raw ? { transformation: [{ raw }] } : {}) });
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer());
    fileCache.set(cacheKey, { at: Date.now(), data });
    return data;
  } catch {
    return null; // print without it rather than fail
  }
}

interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  link?: string;
}

export interface LetterInput {
  snapshot: LetterSnapshot;
  values: Record<string, string>;
  salaryRows: SalaryRow[];
  brand: Brand; // the company letterhead
  draft?: boolean; // "DRAFT" across each page
}

export const modeOf = (s: LetterSnapshot): LetterheadMode => s.letterhead_mode ?? (s.letterhead_path ? "upload" : "company");
const fontOf = (r: { bold: boolean; italic: boolean }) => (r.bold && r.italic ? "Helvetica-BoldOblique" : r.bold ? "Helvetica-Bold" : r.italic ? "Helvetica-Oblique" : "Helvetica");
const plain = (runs: Run[]) => runs.map((r) => r.text).join("");

// The company letterhead: logo, name, legal name / address / contact, and a line under it
function companyHead(doc: PDFKit.PDFDocument, brand: Brand, left: number, width: number, draw: boolean): number {
  const top = 28;
  let textX = left;
  if (brand.logo) {
    try {
      if (draw) doc.image(brand.logo, left, top, { fit: [46, 46] });
      textX = left + 58;
    } catch {
      // unreadable image — letterhead without it
    }
  }
  const w = width - (textX - left);
  const s = brand.settings;
  const lines = [brand.company.legalName, s.showAddress ? brand.company.address : null, s.showContact ? brand.company.contact : null, s.showTaxIds ? brand.company.taxIds : null].filter(Boolean) as string[];
  doc.font("Helvetica-Bold").fontSize(15);
  let y = top + doc.heightOfString(brand.company.name, { width: w });
  if (draw) doc.fillColor(INK).text(brand.company.name, textX, top, { width: w });
  doc.font("Helvetica").fontSize(8.5);
  for (const line of lines) {
    if (draw) doc.fillColor(MUTED).text(line, textX, y + 1, { width: w });
    y += 1 + doc.heightOfString(line, { width: w });
  }
  const lineY = Math.max(y, brand.logo ? top + 46 : y) + 8;
  if (draw) doc.moveTo(left, lineY).lineTo(left + width, lineY).lineWidth(1.2).strokeColor(ACCENT).stroke();
  return lineY;
}

export function bodyPdf(input: LetterInput, signature: Buffer | null): Promise<Buffer> {
  const { snapshot, values, salaryRows, brand } = input;
  const mode = modeOf(snapshot);
  const m = { ...snapshot.margins };
  const doc = new PDFDocument({ size: "A4", margins: m, bufferPages: true, info: { Title: values.letter_number || "Letter", Author: brand.company.name } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const left = m.left;
  const width = doc.page.width - m.left - m.right;

  // Company letterhead: keep the body below it on every page
  if (mode === "company") {
    const headBottom = companyHead(doc, brand, left, width, false) + 14;
    if (headBottom > m.top) {
      m.top = Math.ceil(headBottom);
      doc.page.margins.top = m.top;
      (doc.options as { margins?: typeof m }).margins = { ...m };
      doc.y = m.top;
    }
  }
  const top = () => doc.page.margins.top;
  const bottom = () => doc.page.height - m.bottom;
  const newPage = () => {
    doc.addPage();
    doc.x = left;
  };

  const value = (key: string) => values[key]?.trim() || `[${LABEL.get(key) ?? key.replace(/_/g, " ")}]`;

  // Inline content → runs of text with their marks
  const runsOf = (nodes: LetterDoc[] = []): Run[] =>
    nodes.flatMap((n): Run[] => {
      const marks = new Map((n.marks ?? []).map((x) => [x.type, x.attrs] as const));
      const href = marks.has("link") ? String(marks.get("link")?.href ?? "") : "";
      const style = { bold: marks.has("bold"), italic: marks.has("italic"), underline: marks.has("underline") || Boolean(href), link: href || undefined };
      if (n.type === "text") return [{ text: n.text ?? "", ...style }];
      if (n.type === "variable") return [{ text: value(String(n.attrs?.key ?? "")), ...style }];
      if (n.type === "hardBreak") return [{ text: "\n", ...style }];
      return [];
    });

  const textHeight = (runs: Run[], size: number, w: number, gap = LINE_GAP) => {
    const text = plain(runs);
    if (!text.length) return lineHeight(size, gap);
    doc.font(runs.some((r) => r.bold) ? "Helvetica-Bold" : "Helvetica").fontSize(size);
    return doc.heightOfString(text, { width: w, lineGap: gap });
  };

  interface RunOpts {
    size: number;
    align?: string;
    x?: number;
    w?: number;
    after?: number; // space after (pt)
    gap?: number; // line gap
  }
  const writeRuns = (runs: Run[], o: RunOpts) => {
    const gap = o.gap ?? LINE_GAP;
    const after = o.after ?? lineHeight(o.size, 0) * AFTER_PARA;
    const x = o.x ?? left;
    const w = o.w ?? width;
    // Neighbours with the same style become one piece, so lines wrap between words, not at a {{variable}}
    let list = runs.filter((r) => r.text.length).reduce<Run[]>((acc, r) => {
      const last = acc.at(-1);
      if (last && last.bold === r.bold && last.italic === r.italic && last.underline === r.underline && last.link === r.link) last.text += r.text;
      else acc.push({ ...r });
      return acc;
    }, []);
    // pdfkit can't mix styles on a centred / right-aligned line: print it in one style
    if (list.length > 1 && (o.align === "center" || o.align === "right")) list = [{ ...list[0]!, link: undefined, text: plain(list) }];
    if (!list.length) {
      doc.y += lineHeight(o.size, gap) + after; // an empty line, like in the editor
      return;
    }
    list.forEach((r, i) => {
      doc.font(fontOf(r)).fontSize(o.size).fillColor(r.link ? LINK : INK);
      const opts = { width: w, align: (o.align as "left") ?? "left", underline: r.underline, continued: i < list.length - 1, lineGap: gap, link: r.link ?? null };
      if (i === 0) doc.text(r.text, x, doc.y, opts);
      else doc.text(r.text, opts);
    });
    doc.fillColor(INK);
    doc.x = left;
    doc.y += after;
  };

  // ---- Tables ----
  type Cell = { node: LetterDoc; span: number; header: boolean };
  const tableLayout = (n: LetterDoc, w: number) => {
    const rows = (n.content ?? []).map((r) =>
      (r.content ?? []).map((c): Cell => ({ node: c, span: Math.max(1, Number(c.attrs?.colspan ?? 1)), header: c.type === "tableHeader" })),
    );
    const cols = Math.max(1, ...rows.map((r) => r.reduce((s, c) => s + c.span, 0)));
    // Column widths from the editor (px) when set, else equal
    const first = rows.find((r) => r.reduce((s, c) => s + c.span, 0) === cols);
    const px = first?.flatMap((c) => {
      const cw = c.node.attrs?.colwidth as number[] | null | undefined;
      return Array.from({ length: c.span }, (_, i) => cw?.[i] ?? 0);
    });
    const widths = px && px.every((v) => v > 0) ? px.map((v) => (v / px.reduce((a, b) => a + b, 0)) * w) : Array.from({ length: cols }, () => w / cols);
    const cellParas = (c: Cell) => (c.node.content ?? []).map((p) => (c.header ? runsOf(p.content).map((r) => ({ ...r, bold: true })) : runsOf(p.content)));
    const rowHeight = (r: Cell[]) => {
      let col = 0;
      let h = 0;
      for (const c of r) {
        const cw = widths.slice(col, col + c.span).reduce((a, b) => a + b, 0);
        col += c.span;
        const paras = cellParas(c);
        const ch = paras.reduce((s, p) => s + textHeight(p, CELL.size, cw - CELL.pad * 2, CELL.gap), 0) + Math.max(0, paras.length - 1) * CELL.gap;
        h = Math.max(h, ch + CELL.pad * 2);
      }
      return Math.max(h, lineHeight(CELL.size, CELL.gap) + CELL.pad * 2);
    };
    return { rows, widths, cellParas, rowHeight };
  };
  const table = (n: LetterDoc, x: number, w: number) => {
    const t = tableLayout(n, w);
    for (const r of t.rows) {
      const h = t.rowHeight(r);
      if (doc.y + h > bottom() && doc.y > top() + 1) newPage();
      const y = doc.y;
      let cx = x;
      let col = 0;
      for (const c of r) {
        const cw = t.widths.slice(col, col + c.span).reduce((a, b) => a + b, 0);
        col += c.span;
        if (c.header) doc.rect(cx, y, cw, h).fill("#F1F5F9");
        doc.rect(cx, y, cw, h).lineWidth(0.5).strokeColor(LINE).stroke();
        doc.y = y + CELL.pad;
        const align = (p: LetterDoc) => (p.attrs?.textAlign as string | undefined) ?? "left";
        (c.node.content ?? []).forEach((p, i) => writeRuns(t.cellParas(c)[i]!, { size: CELL.size, gap: CELL.gap, x: cx + CELL.pad, w: cw - CELL.pad * 2, after: CELL.gap, align: align(p) }));
        cx += cw;
      }
      doc.y = y + h;
    }
    doc.x = left;
    doc.y += AFTER_TABLE;
  };

  const salaryTable = () => {
    if (!salaryRows.length) {
      writeRuns([{ text: "[Salary break-up — add a salary structure for this employee]", bold: false, italic: true, underline: false }], { size: BODY });
      return;
    }
    const cols = [width * 0.5, width * 0.25, width * 0.25];
    const row = (cells: string[], bold: boolean, shade: boolean) => {
      if (doc.y + SALARY_ROW > bottom()) newPage();
      const y = doc.y;
      if (shade) doc.rect(left, y, width, SALARY_ROW).fill("#F1F5F9");
      doc.rect(left, y, width, SALARY_ROW).lineWidth(0.5).strokeColor(LINE).stroke();
      let x = left;
      cells.forEach((c, i) => {
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).fillColor(INK).text(c, x + 6, y + 5, { width: cols[i]! - 12, align: i === 0 ? "left" : "right", lineBreak: false });
        x += cols[i]!;
      });
      doc.y = y + SALARY_ROW;
    };
    const money = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-IN")}`;
    row(["Component", "Monthly", "Annual"], true, true);
    for (const r of salaryRows) row([r.label, money(r.monthly), money(r.annual)], false, false);
    const total = salaryRows.reduce((s, r) => s + r.monthly, 0);
    row(["Total (gross)", money(total), money(total * 12)], true, true);
    doc.x = left;
    doc.y += AFTER_TABLE;
  };

  const headingSize = (n: LetterDoc) => HEADING_SIZE[Number(n.attrs?.level ?? 2)] ?? 13.5;

  // How tall a block will be (to keep it on one page when it fits)
  const measure = (n: LetterDoc, indent = 0): number => {
    const w = width - indent;
    switch (n.type) {
      case "paragraph":
        return textHeight(runsOf(n.content), BODY, w) + lineHeight(BODY, 0) * AFTER_PARA;
      case "heading": {
        const size = headingSize(n);
        return textHeight(runsOf(n.content).map((r) => ({ ...r, bold: true })), size, w) + lineHeight(size, 0) * AFTER_HEADING;
      }
      case "bulletList":
      case "orderedList":
        return (n.content ?? []).reduce((s, item) => s + (item.content ?? []).reduce((a, c) => a + measure(c, indent + LIST_INDENT), 0), 0) + AFTER_LIST;
      case "horizontalRule":
        return HR_SPACE.before + HR_SPACE.after;
      case "table": {
        const t = tableLayout(n, w);
        return t.rows.reduce((s, r) => s + t.rowHeight(r), 0) + AFTER_TABLE;
      }
      case "variableBlock":
        return n.attrs?.key === "salary_breakup" ? (salaryRows.length + 2) * SALARY_ROW + AFTER_TABLE : 0;
      default:
        return 0;
    }
  };

  const block = (n: LetterDoc, indent = 0) => {
    const align = (n.attrs?.textAlign as string | undefined) ?? "left";
    switch (n.type) {
      case "paragraph":
        writeRuns(runsOf(n.content), { size: BODY, align, x: left + indent, w: width - indent });
        break;
      case "heading": {
        const size = headingSize(n);
        writeRuns(
          runsOf(n.content).map((r) => ({ ...r, bold: true })),
          { size, align, x: left + indent, w: width - indent, after: lineHeight(size, 0) * AFTER_HEADING },
        );
        break;
      }
      case "bulletList":
      case "orderedList":
        (n.content ?? []).forEach((item, i) => {
          const marker = n.type === "bulletList" ? "•" : `${Number(n.attrs?.start ?? 1) + i}.`;
          const first = item.content?.[0];
          if (first && doc.y + measure(first, indent + LIST_INDENT) > bottom() && doc.y > top() + 1) newPage();
          const y = doc.y;
          doc.font("Helvetica").fontSize(BODY).fillColor(INK).text(marker, left + indent + 4, y, { width: 18, lineBreak: false });
          doc.y = y;
          for (const child of item.content ?? []) block(child, indent + LIST_INDENT);
        });
        doc.y += AFTER_LIST;
        break;
      case "horizontalRule": {
        const y = doc.y + HR_SPACE.before;
        doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.6).strokeColor(LINE).stroke();
        doc.y = y + HR_SPACE.after;
        break;
      }
      case "table":
        table(n, left + indent, width - indent);
        break;
      case "variableBlock":
        if (n.attrs?.key === "salary_breakup") salaryTable();
        break;
      default:
        for (const child of n.content ?? []) block(child, indent);
    }
  };

  // Top-level blocks: a page break starts a new page; a block that fits on a page isn't split
  const blocks = snapshot.body.content ?? [];
  blocks.forEach((n, i) => {
    if (n.type === "pageBreak") {
      if (i < blocks.length - 1) newPage();
      return;
    }
    const room = bottom() - doc.y;
    const h = measure(n) + (n.type === "heading" ? KEEP_WITH_NEXT : 0);
    if (h > room && doc.y > top() + 1 && h <= bottom() - top()) newPage();
    block(n);
  });

  // Sign-off: "For <company>", signature, name and title — kept together
  if (snapshot.signatory_name || snapshot.signatory_title || signature) {
    const h = 12 + lineHeight(BODY, 0) + 5 + (signature ? 52 : 30) + lineHeight(BODY, 0) + lineHeight(10, 0);
    if (doc.y + h > bottom()) newPage();
    doc.y += 12;
    doc.font("Helvetica").fontSize(BODY).fillColor(INK).text(`For ${brand.company.name}`, left, doc.y, { width });
    doc.y += 5;
    if (signature) {
      try {
        doc.image(signature, left, doc.y, { fit: [130, 48] });
      } catch {
        // unreadable image — leave the space to sign
      }
      doc.y += 52;
    } else doc.y += 30;
    if (snapshot.signatory_name) doc.font("Helvetica-Bold").fontSize(BODY).fillColor(INK).text(snapshot.signatory_name, left, doc.y, { width });
    if (snapshot.signatory_title) doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(snapshot.signatory_title, left, doc.y, { width });
  }

  // Every page: the company letterhead
  if (mode === "company") {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      companyHead(doc, brand, left, width, true);
    }
  }

  doc.end();
  return done;
}

// Draws each body page over the uploaded letterhead (PDF page 1 or a full-page image); DRAFT across drafts;
// "Page 1 of 2" just under the body when the letter runs past a page
export async function overlayLetterhead(body: Buffer, letterhead: Buffer | null, opts: { draft: boolean; pageNumbersAt: number | null }): Promise<Buffer> {
  const bodyDoc = await PdfLib.load(body);
  const count = bodyDoc.getPageCount();
  const numbers = opts.pageNumbersAt !== null && count > 1;
  if (!letterhead && !opts.draft && !numbers) return body;
  const out = await PdfLib.create();
  const pages = await out.embedPdf(bodyDoc, bodyDoc.getPageIndices());
  const isPdf = letterhead?.subarray(0, 4).toString() === "%PDF";
  const bgPage = letterhead && isPdf ? (await out.embedPdf(letterhead, [0]))[0] : null;
  const bgImage = letterhead && !isPdf ? await (letterhead[0] === 0x89 ? out.embedPng(letterhead) : out.embedJpg(letterhead)).catch(() => null) : null;
  const font = opts.draft ? await out.embedFont("Helvetica-Bold") : null;
  const small = numbers ? await out.embedFont("Helvetica") : null;
  for (const [i, p] of pages.entries()) {
    const page = out.addPage([p.width, p.height]);
    if (bgPage) page.drawPage(bgPage, { x: 0, y: 0, width: p.width, height: p.height });
    if (bgImage) page.drawImage(bgImage, { x: 0, y: 0, width: p.width, height: p.height });
    page.drawPage(p, { x: 0, y: 0 });
    if (font) page.drawText("DRAFT", { x: p.width / 2 - 130, y: p.height / 2 - 40, size: 90, font, opacity: 0.08, rotate: degrees(35) });
    if (small && opts.pageNumbersAt !== null) {
      const label = `Page ${i + 1} of ${count}`;
      page.drawText(label, { x: (p.width - small.widthOfTextAtSize(label, 8)) / 2, y: opts.pageNumbersAt - 6 - 8, size: 8, font: small, color: rgb(0.392, 0.455, 0.545) });
    }
  }
  return Buffer.from(await out.save());
}

// The finished letter: the body printed, then laid over the uploaded letterhead
export async function renderLetter(input: LetterInput): Promise<Buffer> {
  const upload = modeOf(input.snapshot) === "upload" ? input.snapshot.letterhead_path : null;
  const [letterhead, signature] = await Promise.all([fetchPrivateFile(upload), fetchPrivateFile(input.snapshot.signature_path)]);
  const body = await bodyPdf(input, signature);
  const s = input.snapshot;
  return overlayLetterhead(body, letterhead, { draft: Boolean(input.draft), pageNumbersAt: s.page_numbers === false ? null : s.margins.bottom });
}

// Page 1 of an uploaded letterhead as a PNG, for the editor's page background
export async function letterheadPng(path: string): Promise<Buffer | null> {
  const png = await fetchPrivateFile(path, "f-png,w-1240");
  return png && png[0] === 0x89 ? png : null;
}

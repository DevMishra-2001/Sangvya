// Offer letter PDF on the company letterhead
import type { Brand } from "../reports/branding.js";
import { INK, MUTED, openPdf } from "../reports/exporters/pdfLayout.js";
import type { offerForPdf } from "./recruitment.service.js";

type Data = Awaited<ReturnType<typeof offerForPdf>>;
const date = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "—");
const rupees = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;

export function offerLetterPdf({ candidate, offer }: Data, brand: Brand, printedBy?: string): Promise<Buffer> {
  const page = openPdf(brand, { title: "Offer of employment", printedBy });
  const { doc, left, width } = page;
  const company = brand.company.name;
  const ctc = Number(offer.ctc_annual);
  const p = (text: string, opts: PDFKit.Mixins.TextOptions = {}) => {
    doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(text, left, doc.y, { width, lineGap: 3, ...opts });
    doc.moveDown(0.7);
  };

  doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(`Date: ${date(new Date().toISOString().slice(0, 10))}`, left, doc.y, { width, align: "right" });
  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(candidate.name, left, doc.y);
  if (candidate.email) doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(candidate.email);
  if (candidate.phone) doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(candidate.phone);
  doc.moveDown(1);

  p(`Dear ${candidate.name.split(" ")[0]},`);
  p(`We are pleased to offer you the position of ${offer.designation}${offer.department ? ` in the ${offer.department} team` : ""} at ${company}. We were impressed by your experience and believe you will be a great addition to our team.`);

  // Key terms as a small table
  const rows: [string, string][] = [
    ["Designation", offer.designation],
    ...(offer.department ? [["Department", offer.department] as [string, string]] : []),
    ["Annual CTC", `${rupees(ctc)} (about ${rupees(Math.round(ctc / 12))} per month)`],
    ["Date of joining", date(offer.joining_date)],
    ...(offer.work_location ? [["Work location", offer.work_location] as [string, string]] : []),
    ...(offer.probation_months ? [["Probation", `${offer.probation_months} month${offer.probation_months === 1 ? "" : "s"}`] as [string, string]] : []),
  ];
  const top = doc.y;
  rows.forEach(([k, v], i) => {
    const y = top + i * 20;
    doc.rect(left, y, width, 20).fill(i % 2 ? "#FFFFFF" : "#F8FAFC");
    doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(k, left + 10, y + 6, { width: 130 });
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(v, left + 150, y + 6, { width: width - 160 });
  });
  doc.y = top + rows.length * 20 + 14;

  p("A detailed breakdown of your salary and your appointment letter will be shared when you join. This offer depends on satisfactory verification of your documents and references.");
  if (offer.notes) p(offer.notes);
  p(offer.expires_on ? `Please confirm your acceptance by ${date(offer.expires_on)}.` : "Please confirm your acceptance at the earliest.");
  p("We look forward to welcoming you.");
  doc.moveDown(0.6);
  doc.font("Helvetica").fontSize(10.5).fillColor(INK).text("Warm regards,", left, doc.y);
  doc.font("Helvetica-Bold").text(`For ${company}`);
  doc.moveDown(3);
  doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text("Accepted by: ______________________          Date: ______________", left, doc.y);
  return page.finish();
}

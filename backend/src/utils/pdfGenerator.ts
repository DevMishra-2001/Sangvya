// Payslip PDF on the company's letterhead (see reports/exporters/pdfLayout.ts)
import type { Brand } from "../modules/reports/branding.js";
import { ACCENT, INK, LINE, MUTED, openPdf } from "../modules/reports/exporters/pdfLayout.js";

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface PayslipPdfData {
  employee_name: string;
  employee_code?: string | null;
  designation: string | null;
  department: string | null;
  month?: number | null;
  year?: number | null;
  paid_days: string;
  lop_days?: string | null;
  total_days: number;
  basic: string;
  hra: string;
  allowances: string;
  gross: string;
  pf_employee: string;
  esi_employee: string;
  professional_tax: string;
  tds: string;
  total_deductions: string;
  net_pay: string;
}

const money = (n: string | number) => `Rs. ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// 48250 → "Forty Eight Thousand Two Hundred Fifty" (Indian system: lakh, crore)
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function words(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim();
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} Hundred ${words(n % 100)}`.trim();
  if (n < 100000) return `${words(Math.floor(n / 1000))} Thousand ${words(n % 1000)}`.trim();
  if (n < 10000000) return `${words(Math.floor(n / 100000))} Lakh ${words(n % 100000)}`.trim();
  return `${words(Math.floor(n / 10000000))} Crore ${words(n % 10000000)}`.trim();
}
export const rupeesInWords = (amount: number) => {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  return `Rupees ${rupees ? words(rupees) : "Zero"}${paise ? ` and ${words(paise)} Paise` : ""} Only`;
};

export function generatePayslipPDF(p: PayslipPdfData, brand: Brand, printedBy?: string): Promise<Buffer> {
  const period = `${MONTH_NAMES[p.month ?? 0] ?? ""} ${p.year ?? ""}`.trim();
  const page = openPdf(brand, { title: `Payslip — ${period}`, printedBy });
  const { doc, left, width } = page;

  // Employee details: two columns of label / value
  const details: [string, string][] = [
    ["Employee", p.employee_name],
    ["Employee code", p.employee_code || "—"],
    ["Designation", p.designation || "—"],
    ["Department", p.department || "—"],
    ["Pay period", period],
    ["Paid days", `${Number(p.paid_days)} of ${p.total_days}`],
    ["Loss of pay", `${Number(p.lop_days ?? 0)} day(s)`],
  ];
  const half = width / 2;
  const top = doc.y;
  details.forEach(([k, v], i) => {
    const col = i < 4 ? 0 : 1;
    const y = top + (i < 4 ? i : i - 4) * 16;
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(k, left + col * half, y, { width: 90 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(v, left + col * half + 90, y, { width: half - 100, lineBreak: false, ellipsis: true });
  });
  doc.y = top + 4 * 16 + 14;

  // Earnings | Deductions side by side
  const tableTop = doc.y;
  const gap = 16;
  const colW = (width - gap) / 2;
  const table = (x: number, title: string, rows: [string, string][], total: [string, string]) => {
    let y = tableTop;
    doc.rect(x, y, colW, 20).fill("#F1F5F9");
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#334155").text(title, x + 8, y + 6, { width: colW / 2 });
    doc.text("Amount", x + colW / 2, y + 6, { width: colW / 2 - 8, align: "right" });
    y += 20;
    for (const [k, v] of rows) {
      doc.font("Helvetica").fontSize(9).fillColor(INK).text(k, x + 8, y + 5, { width: colW / 2 });
      doc.text(v, x + colW / 2, y + 5, { width: colW / 2 - 8, align: "right" });
      y += 18;
      doc.moveTo(x, y).lineTo(x + colW, y).lineWidth(0.4).strokeColor(LINE).stroke();
    }
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(total[0], x + 8, y + 6, { width: colW / 2 });
    doc.text(total[1], x + colW / 2, y + 6, { width: colW / 2 - 8, align: "right" });
    y += 22;
    doc.rect(x, tableTop, colW, y - tableTop).lineWidth(0.6).strokeColor("#CBD5E1").stroke();
    return y;
  };
  const endA = table(left, "Earnings", [["Basic", money(p.basic)], ["HRA", money(p.hra)], ["Allowances", money(p.allowances)], ["", ""]], ["Gross earnings", money(p.gross)]);
  const endB = table(
    left + colW + gap,
    "Deductions",
    [["Provident Fund (PF)", money(p.pf_employee)], ["ESI", money(p.esi_employee)], ["Professional tax", money(p.professional_tax)], ["TDS (income tax)", money(p.tds)]],
    ["Total deductions", money(p.total_deductions)],
  );
  doc.y = Math.max(endA, endB) + 16;

  // Net pay
  const ny = doc.y;
  doc.rect(left, ny, width, 46).fill("#EFF6FF");
  doc.rect(left, ny, 4, 46).fill(ACCENT);
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Net pay", left + 14, ny + 8);
  doc.font("Helvetica-Bold").fontSize(15).fillColor(INK).text(money(p.net_pay), left + 14, ny + 21);
  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(rupeesInWords(Number(p.net_pay)), left + width / 2 - 20, ny + 18, { width: width / 2 + 10, align: "right" });
  doc.y = ny + 46 + 18;

  doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text("This is a system-generated payslip. Statutory deductions are estimates — verify against current rules before filing.", left, doc.y, { width });
  return page.finish();
}

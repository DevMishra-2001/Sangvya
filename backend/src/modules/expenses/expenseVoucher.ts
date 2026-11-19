// Printable expense voucher: general details, every section, approval and payment
import type { Brand } from "../reports/branding.js";
import { INK, LINE, MUTED, openPdf } from "../reports/exporters/pdfLayout.js";
import type { claimDetail } from "./expenses.service.js";

type Data = Awaited<ReturnType<typeof claimDetail>>;
const rs = (v: string | number | null | undefined) => `Rs. ${Number(v ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—");

export function expenseVoucherPdf(d: Data, brand: Brand, printedBy?: string): Promise<Buffer> {
  const c = d.claim;
  const page = openPdf(brand, { title: `Expense voucher #${c.id}`, printedBy });
  const { doc, left, width } = page;

  const pairs: [string, string][] = [
    ["Employee", c.employee_name],
    ["Date", date(c.claim_date)],
    ["Trip / visit", c.trip_name],
    ["Client", c.client_name ?? "—"],
    ["Place", [c.locality, c.city, c.state, c.country].filter(Boolean).join(", ") || "—"],
    ["Type", c.expense_type === "international" ? "International" : "Domestic"],
    ["Teammates", c.teammates ?? "—"],
    ["Status", c.status.replace("_", " ").replace(/^./, (x) => x.toUpperCase())],
  ];
  const half = width / 2;
  const top = doc.y;
  pairs.forEach(([k, v], i) => {
    const col = i % 2;
    const y = top + Math.floor(i / 2) * 16;
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(k, left + col * half, y, { width: 80 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(v, left + col * half + 80, y, { width: half - 90, lineBreak: false, ellipsis: true });
  });
  doc.y = top + Math.ceil(pairs.length / 2) * 16 + 12;

  const rows: [string, string, string][] = [];
  if (Number(c.hotel_amount)) rows.push(["Hotel", [c.hotel_name, c.hotel_description].filter(Boolean).join(" — "), rs(c.hotel_amount)]);
  const meals = Number(c.breakfast) + Number(c.lunch) + Number(c.dinner);
  if (meals) rows.push(["Meals", `Breakfast ${rs(c.breakfast)} · Lunch ${rs(c.lunch)} · Dinner ${rs(c.dinner)}${c.meals_description ? ` — ${c.meals_description}` : ""}`, rs(meals)]);
  for (const l of d.localTravel) rows.push(["Local travel", `${l.travel_type.replace("_", " ")}: ${l.from_place ?? ""} to ${l.to_place ?? ""}${l.description ? ` — ${l.description}` : ""}`, rs(l.amount)]);
  for (const l of d.intercityTravel) rows.push(["Inter-city travel", `${l.travel_type.replace("_", " ")}: ${l.from_place ?? ""} to ${l.to_place ?? ""}${l.description ? ` — ${l.description}` : ""}`, rs(l.amount)]);
  if (Number(c.entertainment_amount)) rows.push(["Client entertainment", c.entertainment_description ?? "", rs(c.entertainment_amount)]);
  if (Number(c.other_amount)) rows.push(["Other", c.other_description ?? "", rs(c.other_amount)]);

  // Table
  const cols = [120, width - 120 - 100, 100];
  let y = doc.y;
  doc.rect(left, y, width, 20).fill("#F1F5F9");
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#334155");
  ["Head", "Details", "Amount"].forEach((h, i) => doc.text(h, left + cols.slice(0, i).reduce((a, b) => a + b, 0) + 8, y + 6, { width: cols[i] - 16, align: i === 2 ? "right" : "left" }));
  y += 20;
  for (const [head, det, amt] of rows) {
    const h = Math.max(18, doc.font("Helvetica").fontSize(9).heightOfString(det || " ", { width: cols[1] - 16 }) + 8);
    if (y + h > page.bottom()) {
      page.newPage();
      y = doc.y;
    }
    doc.font("Helvetica").fontSize(9).fillColor(INK);
    doc.text(head, left + 8, y + 5, { width: cols[0] - 16 });
    doc.text(det || "—", left + cols[0] + 8, y + 5, { width: cols[1] - 16 });
    doc.text(amt, left + cols[0] + cols[1] + 8, y + 5, { width: cols[2] - 16, align: "right" });
    y += h;
    doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.4).strokeColor(LINE).stroke();
  }
  doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text("Total claimed", left + 8, y + 8);
  doc.text(rs(c.total), left + cols[0] + cols[1] + 8, y + 8, { width: cols[2] - 16, align: "right" });
  y += 26;
  if (c.approved_amount != null) {
    doc.font("Helvetica").fontSize(9.5).text(`Approved: ${rs(c.approved_amount)}${c.decided_by_name ? ` by ${c.decided_by_name}` : ""}${c.decision_note ? ` — ${c.decision_note}` : ""}`, left, y, { width });
    y = doc.y + 4;
  }
  if (c.paid_amount != null) doc.font("Helvetica").fontSize(9.5).text(`Paid: ${rs(c.paid_amount)} on ${date(c.paid_on)}${c.payment_ref ? ` (ref ${c.payment_ref})` : ""}`, left, y, { width });
  doc.moveDown(3);
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Employee signature: ____________________          Approved by: ____________________", left, doc.y);
  return page.finish();
}

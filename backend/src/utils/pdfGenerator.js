const PDFDocument = require("pdfkit");

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const inr = (n) => `Rs. ${Number(n).toLocaleString("en-IN")}`;

// Builds a simple, clean one-page payslip PDF and returns the PDFDocument
// stream — caller pipes it directly to the HTTP response.
function generatePayslipPDF(payslip) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  doc.fontSize(18).text(payslip.company_name, { align: "left" });
  doc.fontSize(10).fillColor("#666").text("Payslip", { align: "left" });
  doc.moveDown(1.5);

  doc.fillColor("#000").fontSize(12).text(`Pay period: ${MONTH_NAMES[payslip.month] || ""} ${payslip.year || ""}`);
  doc.moveDown(0.5);

  doc.fontSize(11);
  doc.text(`Employee: ${payslip.employee_name}`);
  if (payslip.designation) doc.text(`Designation: ${payslip.designation}`);
  if (payslip.department) doc.text(`Department: ${payslip.department}`);
  doc.text(`Paid days: ${payslip.paid_days} / ${payslip.total_days}`);
  doc.moveDown(1);

  drawTableRow(doc, "Earnings", "Amount", true);
  drawTableRow(doc, "Basic", inr(payslip.basic));
  drawTableRow(doc, "HRA", inr(payslip.hra));
  drawTableRow(doc, "Allowances", inr(payslip.allowances));
  drawTableRow(doc, "Gross Pay", inr(payslip.gross), false, true);
  doc.moveDown(0.8);

  drawTableRow(doc, "Deductions", "Amount", true);
  drawTableRow(doc, "Provident Fund (PF)", inr(payslip.pf_employee));
  drawTableRow(doc, "ESI", inr(payslip.esi_employee));
  drawTableRow(doc, "Professional Tax", inr(payslip.professional_tax));
  drawTableRow(doc, "TDS (Income Tax)", inr(payslip.tds));
  drawTableRow(doc, "Total Deductions", inr(payslip.total_deductions), false, true);
  doc.moveDown(1);

  doc.fontSize(13).fillColor("#1F3A34").text(`Net Pay: ${inr(payslip.net_pay)}`, { align: "left" });

  doc.moveDown(2);
  doc.fontSize(8).fillColor("#888").text(
    "This is a system-generated payslip. Statutory deduction amounts are computed estimates — please verify against current government rules before filing.",
    { width: 450 }
  );

  doc.end();
  return doc;
}

function drawTableRow(doc, label, value, isHeader = false, isTotal = false) {
  doc.fontSize(isHeader ? 11 : 10.5).fillColor(isHeader ? "#5B6660" : "#000");
  const y = doc.y;
  doc.text(label, 50, y, { continued: false });
  doc.text(value, 400, y, { width: 100, align: "right" });
  if (isTotal) doc.moveDown(0.2);
  doc.moveDown(0.3);
}

module.exports = { generatePayslipPDF };

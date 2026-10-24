const { query } = require("../config/db");

const InvoiceModel = {
  async create({ companyId, razorpayPaymentId, razorpayInvoiceId, amount, employeeCount, status, billingMonth, billingYear }) {
    const res = await query(
      `INSERT INTO invoices (company_id, razorpay_payment_id, razorpay_invoice_id, amount, employee_count, status, billing_month, billing_year)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [companyId, razorpayPaymentId, razorpayInvoiceId, amount, employeeCount, status, billingMonth, billingYear]
    );
    return res.rows[0];
  },

  async listForCompany(companyId) {
    const res = await query(
      `SELECT * FROM invoices WHERE company_id = $1 ORDER BY created_at DESC`,
      [companyId]
    );
    return res.rows;
  },
};

module.exports = InvoiceModel;

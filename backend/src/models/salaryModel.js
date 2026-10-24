const { query } = require("../config/db");

const SalaryStructureModel = {
  async set(companyId, { employeeId, basic, hra, allowances, effectiveFrom }) {
    const res = await query(
      `INSERT INTO salary_structures (company_id, employee_id, basic, hra, allowances, effective_from)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE))
       RETURNING *`,
      [companyId, employeeId, basic, hra, allowances, effectiveFrom]
    );
    return res.rows[0];
  },

  // Latest structure as of a given date — supports mid-year revisions.
  async getCurrent(companyId, employeeId, asOfDate = new Date().toISOString().slice(0, 10)) {
    const res = await query(
      `SELECT * FROM salary_structures
       WHERE company_id = $1 AND employee_id = $2 AND effective_from <= $3
       ORDER BY effective_from DESC LIMIT 1`,
      [companyId, employeeId, asOfDate]
    );
    return res.rows[0];
  },

  async listForCompany(companyId) {
    const res = await query(
      `SELECT DISTINCT ON (s.employee_id) s.*, e.name AS employee_name
       FROM salary_structures s JOIN employees e ON e.id = s.employee_id
       WHERE s.company_id = $1
       ORDER BY s.employee_id, s.effective_from DESC`,
      [companyId]
    );
    return res.rows;
  },
};

module.exports = SalaryStructureModel;

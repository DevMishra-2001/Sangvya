const { query } = require("../config/db");

const PayrollModel = {
  async createRun(companyId, month, year) {
    const res = await query(
      `INSERT INTO payroll_runs (company_id, month, year) VALUES ($1, $2, $3) RETURNING *`,
      [companyId, month, year]
    );
    return res.rows[0];
  },

  async findRun(companyId, month, year) {
    const res = await query(
      `SELECT * FROM payroll_runs WHERE company_id = $1 AND month = $2 AND year = $3`,
      [companyId, month, year]
    );
    return res.rows[0];
  },

  async listRuns(companyId) {
    const res = await query(
      `SELECT * FROM payroll_runs WHERE company_id = $1 ORDER BY year DESC, month DESC`,
      [companyId]
    );
    return res.rows;
  },

  async insertPayslip(companyId, payrollRunId, employeeId, calc, paidDays, totalDays) {
    const res = await query(
      `INSERT INTO payslips (
         company_id, payroll_run_id, employee_id, basic, hra, allowances, gross,
         paid_days, total_days, pf_employee, pf_employer, esi_employee, esi_employer,
         professional_tax, tds, total_deductions, net_pay
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        companyId, payrollRunId, employeeId, calc.basic, calc.hra, calc.allowances, calc.gross,
        paidDays, totalDays, calc.pfEmployee, calc.pfEmployer, calc.esiEmployee, calc.esiEmployer,
        calc.professionalTax, calc.tds, calc.totalDeductions, calc.netPay,
      ]
    );
    return res.rows[0];
  },

  async listPayslipsForRun(companyId, payrollRunId) {
    const res = await query(
      `SELECT p.*, e.name AS employee_name, e.designation
       FROM payslips p JOIN employees e ON e.id = p.employee_id
       WHERE p.company_id = $1 AND p.payroll_run_id = $2
       ORDER BY e.name`,
      [companyId, payrollRunId]
    );
    return res.rows;
  },

  async getPayslip(companyId, payslipId) {
    const res = await query(
      `SELECT p.*, e.name AS employee_name, e.designation, e.department,
              c.name AS company_name
       FROM payslips p
       JOIN employees e ON e.id = p.employee_id
       JOIN companies c ON c.id = p.company_id
       WHERE p.company_id = $1 AND p.id = $2`,
      [companyId, payslipId]
    );
    return res.rows[0];
  },

  async listForEmployee(companyId, employeeId) {
    const res = await query(
      `SELECT p.*, r.month, r.year
       FROM payslips p JOIN payroll_runs r ON r.id = p.payroll_run_id
       WHERE p.company_id = $1 AND p.employee_id = $2
       ORDER BY r.year DESC, r.month DESC`,
      [companyId, employeeId]
    );
    return res.rows;
  },
};

module.exports = PayrollModel;

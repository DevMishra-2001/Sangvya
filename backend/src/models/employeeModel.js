const { query } = require("../config/db");

// Every function takes companyId and includes it in the WHERE clause.
// This is what actually enforces multi-tenancy at the data layer —
// even if a controller bug let a stray id through, these queries never
// touch another company's rows.
const EmployeeModel = {
  async create(companyId, { name, designation, department, email, joinDate, salary, managerId, dateOfBirth, olQuota, employeeCode }) {
    const res = await query(
      `INSERT INTO employees (company_id, name, designation, department, email, join_date, salary, manager_id, date_of_birth, ol_quota, employee_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [companyId, name, designation, department, email, joinDate, salary, managerId || null, dateOfBirth || null, olQuota === "" || olQuota == null ? null : olQuota, employeeCode?.trim() || null]
    );
    return res.rows[0];
  },

  async findAll(companyId) {
    const res = await query(
      `SELECT * FROM employees WHERE company_id = $1 ORDER BY created_at DESC`,
      [companyId]
    );
    return res.rows;
  },

  async findById(companyId, id) {
    const res = await query(
      `SELECT * FROM employees WHERE company_id = $1 AND id = $2`,
      [companyId, id]
    );
    return res.rows[0];
  },

  async update(companyId, id, { name, designation, department, email, joinDate, salary, managerId, dateOfBirth, olQuota, employeeCode }) {
    const res = await query(
      `UPDATE employees
       SET name = $3, designation = $4, department = $5, email = $6, join_date = $7, salary = $8, manager_id = $9, date_of_birth = $10, ol_quota = $11, employee_code = $12
       WHERE company_id = $1 AND id = $2
       RETURNING *`,
      [companyId, id, name, designation, department, email, joinDate, salary, managerId || null, dateOfBirth || null, olQuota === "" || olQuota == null ? null : olQuota, employeeCode?.trim() || null]
    );
    return res.rows[0];
  },

  // Employees whose "Reports to" is the given employee (a manager's team).
  async findReports(companyId, managerId) {
    const res = await query(
      `SELECT * FROM employees WHERE company_id = $1 AND manager_id = $2 ORDER BY name`,
      [companyId, managerId]
    );
    return res.rows;
  },

  // Employee plus whoever they report to. Manager email falls back to the
  // manager's login email when their employee record has none.
  async findWithManager(companyId, id) {
    const res = await query(
      `SELECT e.*, m.name AS manager_name, COALESCE(m.email, u.email) AS manager_email
       FROM employees e
       LEFT JOIN employees m ON m.id = e.manager_id
       LEFT JOIN users u ON u.employee_id = m.id
       WHERE e.company_id = $1 AND e.id = $2`,
      [companyId, id]
    );
    return res.rows[0];
  },

  async remove(companyId, id) {
    const res = await query(
      `DELETE FROM employees WHERE company_id = $1 AND id = $2 RETURNING id`,
      [companyId, id]
    );
    return res.rows[0];
  },
};

module.exports = EmployeeModel;

const { query } = require("../config/db");

const LeaveModel = {
  async create(companyId, { employeeId, fromDate, toDate, reason, leaveType = "leave" }) {
    const res = await query(
      `INSERT INTO leave_requests (company_id, employee_id, from_date, to_date, reason, leave_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [companyId, employeeId, fromDate, toDate, reason, leaveType]
    );
    return res.rows[0];
  },

  // Pending/approved requests of an employee touching [fromDate, toDate] — used
  // both to block double-booking and to paint the calendar.
  async findOverlapping(companyId, employeeId, fromDate, toDate, { includeRejected = false } = {}) {
    const res = await query(
      `SELECT * FROM leave_requests
       WHERE company_id = $1 AND employee_id = $2
         AND from_date <= $4 AND to_date >= $3
         ${includeRejected ? "" : "AND status <> 'rejected'"}
       ORDER BY from_date`,
      [companyId, employeeId, fromDate, toDate]
    );
    return res.rows;
  },

  async findAll(companyId) {
    const res = await query(
      `SELECT l.*, e.name AS employee_name
       FROM leave_requests l JOIN employees e ON e.id = l.employee_id
       WHERE l.company_id = $1
       ORDER BY l.created_at DESC`,
      [companyId]
    );
    return res.rows;
  },

  async findByEmployee(companyId, employeeId) {
    const res = await query(
      `SELECT l.*, e.name AS employee_name
       FROM leave_requests l JOIN employees e ON e.id = l.employee_id
       WHERE l.company_id = $1 AND l.employee_id = $2
       ORDER BY l.created_at DESC`,
      [companyId, employeeId]
    );
    return res.rows;
  },

  async findById(companyId, id) {
    const res = await query(
      `SELECT l.*, e.name AS employee_name
       FROM leave_requests l JOIN employees e ON e.id = l.employee_id
       WHERE l.company_id = $1 AND l.id = $2`,
      [companyId, id]
    );
    return res.rows[0];
  },

  async updateStatus(companyId, id, status, reviewedBy) {
    const res = await query(
      `UPDATE leave_requests SET status = $3, reviewed_by = $4, reviewed_at = now()
       WHERE company_id = $1 AND id = $2 RETURNING *`,
      [companyId, id, status, reviewedBy]
    );
    return res.rows[0];
  },

  // An employee's leaves touching [from, to], with who reviewed them.
  async findForEmployeeInRange(companyId, employeeId, from, to) {
    const res = await query(
      `SELECT l.*, e.name AS employee_name, u.name AS reviewed_by_name
       FROM leave_requests l
       JOIN employees e ON e.id = l.employee_id
       LEFT JOIN users u ON u.id = l.reviewed_by
       WHERE l.company_id = $1 AND l.employee_id = $2 AND l.from_date <= $4 AND l.to_date >= $3
       ORDER BY l.from_date`,
      [companyId, employeeId, from, to]
    );
    return res.rows;
  },
};

module.exports = LeaveModel;

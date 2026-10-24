const { query } = require("../config/db");

const ReviewModel = {
  // Upsert: submitting a second time for the same employee+cycle updates
  // the existing draft instead of erroring (see UNIQUE constraint in migrate.js).
  async upsert(companyId, { cycleId, employeeId, rating, strengths, improvements, goalsNextCycle, managerComments, status }) {
    const res = await query(
      `INSERT INTO performance_reviews
         (company_id, cycle_id, employee_id, rating, strengths, improvements, goals_next_cycle, manager_comments, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (cycle_id, employee_id) DO UPDATE SET
         rating = EXCLUDED.rating,
         strengths = EXCLUDED.strengths,
         improvements = EXCLUDED.improvements,
         goals_next_cycle = EXCLUDED.goals_next_cycle,
         manager_comments = EXCLUDED.manager_comments,
         status = EXCLUDED.status,
         updated_at = now()
       RETURNING *`,
      [companyId, cycleId, employeeId, rating, strengths, improvements, goalsNextCycle, managerComments, status || "draft"]
    );
    return res.rows[0];
  },

  async findByCycle(companyId, cycleId) {
    const res = await query(
      `SELECT r.*, e.name AS employee_name, e.designation
       FROM performance_reviews r JOIN employees e ON e.id = r.employee_id
       WHERE r.company_id = $1 AND r.cycle_id = $2
       ORDER BY e.name`,
      [companyId, cycleId]
    );
    return res.rows;
  },

  async findByEmployee(companyId, employeeId) {
    const res = await query(
      `SELECT r.*, c.name AS cycle_name
       FROM performance_reviews r JOIN review_cycles c ON c.id = r.cycle_id
       WHERE r.company_id = $1 AND r.employee_id = $2
       ORDER BY c.start_date DESC`,
      [companyId, employeeId]
    );
    return res.rows;
  },

  async updateStatus(companyId, id, status) {
    const res = await query(
      `UPDATE performance_reviews SET status = $3, updated_at = now()
       WHERE company_id = $1 AND id = $2 RETURNING *`,
      [companyId, id, status]
    );
    return res.rows[0];
  },
};

module.exports = ReviewModel;

const { query } = require("../config/db");

const CycleModel = {
  async create(companyId, { name, startDate, endDate }) {
    const res = await query(
      `INSERT INTO review_cycles (company_id, name, start_date, end_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [companyId, name, startDate, endDate]
    );
    return res.rows[0];
  },

  async findAll(companyId) {
    const res = await query(
      `SELECT c.*, COUNT(r.id) AS review_count
       FROM review_cycles c LEFT JOIN performance_reviews r ON r.cycle_id = c.id
       WHERE c.company_id = $1
       GROUP BY c.id
       ORDER BY c.start_date DESC`,
      [companyId]
    );
    return res.rows;
  },

  async updateStatus(companyId, id, status) {
    const res = await query(
      `UPDATE review_cycles SET status = $3 WHERE company_id = $1 AND id = $2 RETURNING *`,
      [companyId, id, status]
    );
    return res.rows[0];
  },
};

module.exports = CycleModel;

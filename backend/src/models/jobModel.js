const { query } = require("../config/db");

const JobModel = {
  async create(companyId, { title, department, location, description }) {
    const res = await query(
      `INSERT INTO job_postings (company_id, title, department, location, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [companyId, title, department, location, description]
    );
    return res.rows[0];
  },

  async findAll(companyId) {
    const res = await query(
      `SELECT j.*, COUNT(c.id) AS candidate_count
       FROM job_postings j LEFT JOIN candidates c ON c.job_posting_id = j.id
       WHERE j.company_id = $1
       GROUP BY j.id
       ORDER BY j.created_at DESC`,
      [companyId]
    );
    return res.rows;
  },

  async findById(companyId, id) {
    const res = await query(`SELECT * FROM job_postings WHERE company_id = $1 AND id = $2`, [companyId, id]);
    return res.rows[0];
  },

  async updateStatus(companyId, id, status) {
    const res = await query(
      `UPDATE job_postings SET status = $3 WHERE company_id = $1 AND id = $2 RETURNING *`,
      [companyId, id, status]
    );
    return res.rows[0];
  },

  async remove(companyId, id) {
    const res = await query(`DELETE FROM job_postings WHERE company_id = $1 AND id = $2 RETURNING id`, [companyId, id]);
    return res.rows[0];
  },
};

module.exports = JobModel;

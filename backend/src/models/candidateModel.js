const { query } = require("../config/db");

const CandidateModel = {
  async create(companyId, { jobPostingId, name, email, phone, resumeUrl, notes }) {
    const res = await query(
      `INSERT INTO candidates (company_id, job_posting_id, name, email, phone, resume_url, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [companyId, jobPostingId, name, email, phone, resumeUrl, notes]
    );
    return res.rows[0];
  },

  async findAll(companyId) {
    const res = await query(
      `SELECT c.*, j.title AS job_title
       FROM candidates c JOIN job_postings j ON j.id = c.job_posting_id
       WHERE c.company_id = $1
       ORDER BY c.created_at DESC`,
      [companyId]
    );
    return res.rows;
  },

  async findByJob(companyId, jobPostingId) {
    const res = await query(
      `SELECT * FROM candidates WHERE company_id = $1 AND job_posting_id = $2 ORDER BY created_at DESC`,
      [companyId, jobPostingId]
    );
    return res.rows;
  },

  async updateStage(companyId, id, stage) {
    const res = await query(
      `UPDATE candidates SET stage = $3 WHERE company_id = $1 AND id = $2 RETURNING *`,
      [companyId, id, stage]
    );
    return res.rows[0];
  },

  async update(companyId, id, { name, email, phone, notes }) {
    const res = await query(
      `UPDATE candidates SET name = $3, email = $4, phone = $5, notes = $6
       WHERE company_id = $1 AND id = $2 RETURNING *`,
      [companyId, id, name, email, phone, notes]
    );
    return res.rows[0];
  },

  async remove(companyId, id) {
    const res = await query(`DELETE FROM candidates WHERE company_id = $1 AND id = $2 RETURNING id`, [companyId, id]);
    return res.rows[0];
  },
};

module.exports = CandidateModel;

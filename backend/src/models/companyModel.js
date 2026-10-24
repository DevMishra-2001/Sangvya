const { query } = require("../config/db");

const CompanyModel = {
  async create({ name, industry }) {
    const res = await query(
      `INSERT INTO companies (name, industry) VALUES ($1, $2) RETURNING *`,
      [name, industry]
    );
    return res.rows[0];
  },

  async findById(id) {
    const res = await query(`SELECT * FROM companies WHERE id = $1`, [id]);
    return res.rows[0];
  },
};

module.exports = CompanyModel;

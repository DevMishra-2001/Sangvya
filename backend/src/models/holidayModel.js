const { query } = require("../config/db");

const HolidayModel = {
  async create(companyId, { date, name }) {
    const res = await query(
      `INSERT INTO holidays (company_id, date, name) VALUES ($1, $2, $3) RETURNING *`,
      [companyId, date, name]
    );
    return res.rows[0];
  },

  async findInRange(companyId, fromDate, toDate) {
    const res = await query(
      `SELECT * FROM holidays WHERE company_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date`,
      [companyId, fromDate, toDate]
    );
    return res.rows;
  },

  async findAll(companyId) {
    const res = await query(`SELECT * FROM holidays WHERE company_id = $1 ORDER BY date`, [companyId]);
    return res.rows;
  },

  async findByDate(companyId, date) {
    const res = await query(`SELECT * FROM holidays WHERE company_id = $1 AND date = $2`, [companyId, date]);
    return res.rows[0];
  },

  async remove(companyId, id) {
    const res = await query(`DELETE FROM holidays WHERE company_id = $1 AND id = $2 RETURNING id`, [companyId, id]);
    return res.rows[0];
  },
};

module.exports = HolidayModel;

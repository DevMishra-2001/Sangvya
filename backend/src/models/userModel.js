const { query } = require("../config/db");

const PUBLIC_COLUMNS = "id, company_id, employee_id, name, email, role, font_size, created_at";

const UserModel = {
  async create({ companyId, name, email, passwordHash, role = "employee", employeeId = null }) {
    const res = await query(
      `INSERT INTO users (company_id, name, email, password_hash, role, employee_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${PUBLIC_COLUMNS}`,
      [companyId, name, email, passwordHash, role, employeeId]
    );
    return res.rows[0];
  },

  async findByEmail(email) {
    const res = await query(`SELECT * FROM users WHERE email = $1`, [email]);
    return res.rows[0];
  },

  async findById(id) {
    const res = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
    return res.rows[0];
  },

  // ---- Company-scoped (used by user management) ----

  async findAll(companyId) {
    const res = await query(
      `SELECT u.id, u.company_id, u.employee_id, u.name, u.email, u.role, u.created_at,
              e.name AS employee_name
       FROM users u LEFT JOIN employees e ON e.id = u.employee_id
       WHERE u.company_id = $1
       ORDER BY u.created_at`,
      [companyId]
    );
    return res.rows;
  },

  async findInCompany(companyId, id) {
    const res = await query(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE company_id = $1 AND id = $2`,
      [companyId, id]
    );
    return res.rows[0];
  },

  async findByEmployeeId(companyId, employeeId) {
    const res = await query(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE company_id = $1 AND employee_id = $2`,
      [companyId, employeeId]
    );
    return res.rows[0];
  },

  async update(companyId, id, { name, role, employeeId }) {
    const res = await query(
      `UPDATE users SET name = $3, role = $4, employee_id = $5
       WHERE company_id = $1 AND id = $2
       RETURNING ${PUBLIC_COLUMNS}`,
      [companyId, id, name, role, employeeId]
    );
    return res.rows[0];
  },

  // Case-insensitive email lookup (forgot password: users type their email freely).
  async findByEmailInsensitive(email) {
    const res = await query(`SELECT id, name, email FROM users WHERE lower(email) = lower($1)`, [email]);
    return res.rows[0];
  },

  // Includes password_hash — only for verifying the current password.
  async findWithPasswordById(id) {
    const res = await query(`SELECT id, password_hash FROM users WHERE id = $1`, [id]);
    return res.rows[0];
  },

  async updatePassword(id, passwordHash) {
    const res = await query(`UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING id`, [id, passwordHash]);
    return res.rows[0];
  },

  // Only ever updates the given user's own row.
  async updateFontSize(id, fontSize) {
    const res = await query(`UPDATE users SET font_size = $2 WHERE id = $1 RETURNING font_size`, [id, fontSize]);
    return res.rows[0]?.font_size;
  },

  async remove(companyId, id) {
    const res = await query(`DELETE FROM users WHERE company_id = $1 AND id = $2 RETURNING id`, [companyId, id]);
    return res.rows[0];
  },
};

module.exports = UserModel;

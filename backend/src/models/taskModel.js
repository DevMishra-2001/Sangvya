const { query } = require("../config/db");

// Every task row comes back with the names the UI shows on a task card.
const SELECT_TASK = `
  SELECT t.*,
         e.name AS assigned_to_name,
         ab.name AS assigned_by_name,
         ap.name AS approved_by_name
  FROM tasks t
  JOIN employees e ON e.id = t.assigned_to
  LEFT JOIN users ab ON ab.id = t.assigned_by
  LEFT JOIN users ap ON ap.id = t.approved_by`;

const TaskModel = {
  async create(companyId, { title, description, priority, assignedTo, assignedBy, dueDate, assignedDate }) {
    const res = await query(
      `INSERT INTO tasks (company_id, title, description, priority, assigned_to, assigned_by, due_date, assigned_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [companyId, title, description, priority, assignedTo, assignedBy, dueDate || null, assignedDate]
    );
    return this.findById(companyId, res.rows[0].id);
  },

  async findById(companyId, id) {
    const res = await query(`${SELECT_TASK} WHERE t.company_id = $1 AND t.id = $2`, [companyId, id]);
    return res.rows[0];
  },

  // Open work first (by due date), then finished tasks newest-first
  async findForAssignee(companyId, employeeId) {
    const res = await query(
      `${SELECT_TASK}
       WHERE t.company_id = $1 AND t.assigned_to = $2
       ORDER BY (t.status IN ('done', 'approved')), t.due_date NULLS LAST, t.created_at DESC`,
      [companyId, employeeId]
    );
    return res.rows;
  },

  async findByAssigner(companyId, userId) {
    const res = await query(
      `${SELECT_TASK}
       WHERE t.company_id = $1 AND t.assigned_by = $2
       ORDER BY (t.status = 'approved'), t.due_date NULLS LAST, t.created_at DESC`,
      [companyId, userId]
    );
    return res.rows;
  },

  async findAll(companyId) {
    const res = await query(
      `${SELECT_TASK}
       WHERE t.company_id = $1
       ORDER BY (t.status = 'approved'), t.due_date NULLS LAST, t.created_at DESC`,
      [companyId]
    );
    return res.rows;
  },

  async updateProgress(companyId, id, { status, progress }) {
    await query(
      `UPDATE tasks
       SET status = $3::varchar, progress = $4, updated_at = now(),
           completed_at = CASE WHEN $3::varchar = 'done' THEN COALESCE(completed_at, now()) ELSE NULL END
       WHERE company_id = $1 AND id = $2`,
      [companyId, id, status, progress]
    );
    return this.findById(companyId, id);
  },

  async approve(companyId, id, userId) {
    await query(
      `UPDATE tasks SET status = 'approved', approved_by = $3, approved_at = now(), updated_at = now()
       WHERE company_id = $1 AND id = $2`,
      [companyId, id, userId]
    );
    return this.findById(companyId, id);
  },

  async reopen(companyId, id) {
    await query(
      `UPDATE tasks SET status = 'in_progress', progress = LEAST(progress, 90), completed_at = NULL,
              approved_by = NULL, approved_at = NULL, updated_at = now()
       WHERE company_id = $1 AND id = $2`,
      [companyId, id]
    );
    return this.findById(companyId, id);
  },

  async remove(companyId, id) {
    const res = await query(`DELETE FROM tasks WHERE company_id = $1 AND id = $2 RETURNING id`, [companyId, id]);
    return res.rows[0];
  },
};

module.exports = TaskModel;

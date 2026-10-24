const { query } = require("../config/db");

const AttendanceModel = {
  // Upsert: marking the same employee/date twice updates the status
  // instead of creating a duplicate row (see UNIQUE constraint in migrate.js).
  async mark(companyId, { employeeId, date, status }) {
    const res = await query(
      `INSERT INTO attendance (company_id, employee_id, date, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (employee_id, date)
       DO UPDATE SET status = EXCLUDED.status
       RETURNING *`,
      [companyId, employeeId, date, status]
    );
    return res.rows[0];
  },

  async findByDate(companyId, date) {
    const res = await query(
      `SELECT a.*, e.name AS employee_name
       FROM attendance a JOIN employees e ON e.id = a.employee_id
       WHERE a.company_id = $1 AND a.date = $2`,
      [companyId, date]
    );
    return res.rows;
  },

  async findByEmployee(companyId, employeeId, fromDate, toDate) {
    const res = await query(
      `SELECT * FROM attendance
       WHERE company_id = $1 AND employee_id = $2 AND date BETWEEN $3 AND $4
       ORDER BY date`,
      [companyId, employeeId, fromDate, toDate]
    );
    return res.rows;
  },

  // ---- Self-service punch in/out ----

  async findOne(companyId, employeeId, date) {
    const res = await query(
      `SELECT * FROM attendance WHERE company_id = $1 AND employee_id = $2 AND date = $3`,
      [companyId, employeeId, date]
    );
    return res.rows[0];
  },

  // The day still running (punched in, not out). Looks back one day so a
  // shift that crosses midnight can still be closed.
  async findOpen(companyId, employeeId, today) {
    const res = await query(
      `SELECT * FROM attendance
       WHERE company_id = $1 AND employee_id = $2
         AND punch_in IS NOT NULL AND punch_out IS NULL
         AND date >= $3::date - 1
       ORDER BY date DESC LIMIT 1`,
      [companyId, employeeId, today]
    );
    return res.rows[0];
  },

  // Creates the day's row, or fills punch_in on a row HR already marked.
  async punchIn(companyId, employeeId, date, at, { location = null, remarks = null } = {}) {
    const res = await query(
      `INSERT INTO attendance (company_id, employee_id, date, status, punch_in, punch_in_location, punch_in_remarks)
       VALUES ($1, $2, $3, 'present', $4, $5, $6)
       ON CONFLICT (employee_id, date)
       DO UPDATE SET punch_in = EXCLUDED.punch_in, status = 'present',
                     punch_in_location = EXCLUDED.punch_in_location, punch_in_remarks = EXCLUDED.punch_in_remarks
       WHERE attendance.punch_in IS NULL
       RETURNING *`,
      [companyId, employeeId, date, at, location, remarks]
    );
    return res.rows[0]; // undefined if already punched in
  },

  // Punching in again after a punch-out on the same day: the time away becomes a
  // break (last punch-out → now) and the day is open again. One statement, so
  // two quick clicks can't create two breaks.
  async resume(companyId, id, at) {
    const res = await query(
      `WITH old AS (
         SELECT id, punch_out FROM attendance
         WHERE company_id = $1 AND id = $2 AND punch_out IS NOT NULL
         FOR UPDATE
       ), gap AS (
         INSERT INTO attendance_breaks (company_id, attendance_id, break_start, break_end)
         SELECT $1, id, punch_out, $3 FROM old
       )
       UPDATE attendance a
       SET punch_out = NULL, punch_out_location = NULL, punch_out_remarks = NULL
       FROM old WHERE a.id = old.id
       RETURNING a.*`,
      [companyId, id, at]
    );
    return res.rows[0]; // undefined if it wasn't punched out
  },

  // One entry in the punch log (every punch in / out keeps its own location + remarks)
  async logPunch(companyId, attendanceId, kind, at, { location = null, remarks = null } = {}) {
    await query(
      `INSERT INTO attendance_punches (company_id, attendance_id, kind, punched_at, location, remarks)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [companyId, attendanceId, kind, at, location, remarks]
    );
  },

  // { attendanceId: [punch, …] } in time order
  async punchesFor(companyId, attendanceIds) {
    if (attendanceIds.length === 0) return {};
    const res = await query(
      `SELECT * FROM attendance_punches
       WHERE company_id = $1 AND attendance_id = ANY($2::uuid[])
       ORDER BY punched_at, kind`,
      [companyId, attendanceIds]
    );
    const grouped = {};
    for (const p of res.rows) (grouped[p.attendance_id] ||= []).push(p);
    return grouped;
  },

  // Closed past days whose end-of-day check (manager email) hasn't run yet.
  async findDaysToClose(today) {
    const res = await query(
      `SELECT * FROM attendance
       WHERE date < $1 AND punch_in IS NOT NULL AND day_closed_at IS NULL
       ORDER BY date LIMIT 200`,
      [today]
    );
    return res.rows;
  },

  async markDayClosed(id) {
    await query(`UPDATE attendance SET day_closed_at = now() WHERE id = $1`, [id]);
  },

  async punchOut(companyId, id, at, { location = null, remarks = null } = {}) {
    const res = await query(
      `UPDATE attendance SET punch_out = $3, punch_out_location = $4, punch_out_remarks = $5
       WHERE company_id = $1 AND id = $2 AND punch_out IS NULL
       RETURNING *`,
      [companyId, id, at, location, remarks]
    );
    return res.rows[0];
  },

  async startBreak(companyId, attendanceId, at) {
    const res = await query(
      `INSERT INTO attendance_breaks (company_id, attendance_id, break_start)
       VALUES ($1, $2, $3) RETURNING *`,
      [companyId, attendanceId, at]
    );
    return res.rows[0];
  },

  // Closes the running break (if any) for a day.
  async endBreak(companyId, attendanceId, at) {
    const res = await query(
      `UPDATE attendance_breaks SET break_end = $3
       WHERE company_id = $1 AND attendance_id = $2 AND break_end IS NULL
       RETURNING *`,
      [companyId, attendanceId, at]
    );
    return res.rows[0];
  },

  // Breaks for several days at once, grouped as { attendanceId: [breaks] }.
  async breaksFor(companyId, attendanceIds) {
    if (attendanceIds.length === 0) return {};
    const res = await query(
      `SELECT * FROM attendance_breaks
       WHERE company_id = $1 AND attendance_id = ANY($2::uuid[])
       ORDER BY break_start`,
      [companyId, attendanceIds]
    );
    const grouped = {};
    for (const b of res.rows) (grouped[b.attendance_id] ||= []).push(b);
    return grouped;
  },
};

module.exports = AttendanceModel;

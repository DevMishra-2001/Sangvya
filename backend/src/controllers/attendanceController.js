const AttendanceModel = require("../models/attendanceModel");

async function mark(req, res) {
  const { employeeId, date, status } = req.body;
  const record = await AttendanceModel.mark(req.companyId, { employeeId, date, status });
  res.json({ attendance: record });
}

async function byDate(req, res) {
  const { date } = req.query;
  const records = await AttendanceModel.findByDate(req.companyId, date);
  res.json({ attendance: records });
}

async function byEmployee(req, res) {
  const { employeeId } = req.params;
  const { from, to } = req.query;
  const records = await AttendanceModel.findByEmployee(req.companyId, employeeId, from, to);
  res.json({ attendance: records });
}

module.exports = { mark, byDate, byEmployee };

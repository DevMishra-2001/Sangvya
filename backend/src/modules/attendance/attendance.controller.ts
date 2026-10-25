import { asyncHandler } from "../../utils/asyncHandler.js";
import { tenant } from "../../utils/requestContext.js";
import { attendanceByDate, findAttendanceInRange, markAttendance } from "./attendance.service.js";

// POST /api/attendance
export const markAttendanceHandler = asyncHandler(async (req, res) => {
  res.json(await markAttendance(tenant(req).companyId, req.body));
});

// GET /api/attendance?date=YYYY-MM-DD
export const attendanceByDateHandler = asyncHandler(async (req, res) => {
  res.json(await attendanceByDate(tenant(req).companyId, String(req.query.date)));
});

// GET /api/attendance/employee/:employeeId?from=&to=
export const employeeAttendanceHandler = asyncHandler(async (req, res) => {
  const records = await findAttendanceInRange(
    tenant(req).companyId,
    Number(req.params.employeeId),
    String(req.query.from),
    String(req.query.to),
  );
  res.json({ attendance: records });
});

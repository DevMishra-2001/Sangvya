import type { Request } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { BadRequestError } from "../../utils/httpErrors.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { tenant } from "../../utils/requestContext.js";
import {
  attendanceDay,
  breakEnd,
  breakStart,
  calendar,
  leaveBalance,
  myLeaves,
  punchIn,
  profile,
  punchOut,
  today,
  updatePhoto,
  type Self,
} from "./self.service.js";

// The logged-in user's company + linked employee (requireEmployeeLink runs first)
function self(req: Request): Self {
  const { companyId, user } = tenant(req);
  if (!user.employeeId) throw new BadRequestError("Your login isn't linked to an employee record — ask HR to link it");
  return { companyId, employeeId: user.employeeId };
}

const queryString = (value: unknown) => (typeof value === "string" ? value : undefined);

// GET /api/me/today
export const todayHandler = asyncHandler(async (req, res) => {
  res.json(await today(self(req)));
});

// POST /api/me/punch-in  { location?, remarks? }
export const punchInHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await punchIn(self(req), req.body));
});

// POST /api/me/break-start
export const breakStartHandler = asyncHandler(async (req, res) => {
  res.json(await breakStart(self(req)));
});

// POST /api/me/break-end
export const breakEndHandler = asyncHandler(async (req, res) => {
  res.json(await breakEnd(self(req)));
});

// POST /api/me/punch-out  { location?, remarks? }
export const punchOutHandler = asyncHandler(async (req, res) => {
  res.json(await punchOut(self(req), req.body));
});

// GET /api/me/calendar?month=YYYY-MM
export const calendarHandler = asyncHandler(async (req, res) => {
  res.json(await calendar(self(req), queryString(req.query.month)));
});

// GET /api/me/attendance?date=YYYY-MM-DD
export const attendanceDayHandler = asyncHandler(async (req, res) => {
  res.json(await attendanceDay(self(req), queryString(req.query.date)));
});

// GET /api/me/leave-balance
export const leaveBalanceHandler = asyncHandler(async (req, res) => {
  res.json(await leaveBalance(self(req)));
});

// GET /api/me/leaves?month=YYYY-MM
export const myLeavesHandler = asyncHandler(async (req, res) => {
  res.json(await myLeaves(self(req), queryString(req.query.month)));
});

// GET /api/me/profile
export const profileHandler = asyncHandler(async (req, res) => {
  res.json(await profile(self(req)));
});

// PUT /api/me/photo  { photoUrl | null }
export const updatePhotoHandler = asyncHandler(async (req, res) => {
  res.json(await updatePhoto(self(req), req.body.photoUrl ?? null));
});
